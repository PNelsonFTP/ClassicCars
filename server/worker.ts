import "dotenv/config";
import { db } from "./db";
import { collect } from "./ingest/collector";
import { operations } from "./ingest/state";
import { getSettings, acquireLease } from "./store";
import { evaluateAlerts, deliverDigests } from "./alerts";
import { serviceJobCompletion } from "./ingest/job-result";
let stopped = false;
let wake: (() => void) | undefined;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    stopped = true;
    wake?.();
  });
console.log(
  "MuscleScout worker running. Durable jobs resume at request boundaries. Geocoding/routing require explicit jobs; external delivery remains opt-in.",
);
while (!stopped) {
  const lease = await acquireLease("musclescout-worker-cycle", 1800);
  if (lease) {
    const heartbeat = setInterval(
      () =>
        lease.renew().catch(() => {
          stopped = true;
          wake?.();
        }),
      30000,
    );
    try {
      await operations.recoverJobs();
      const request = await db.setting.findUnique({
        where: { key: "collection-request" },
      });
      if (request) {
        const old = JSON.parse(request.value);
        await operations.enqueue({
          scope: old.scope === "nationwide" ? "nationwide" : "regional",
          origin: "legacy",
        });
        await db.setting.deleteMany({
          where: { key: "collection-request", value: request.value },
        });
      }
      const settings = await getSettings();
      const legacy = await db.setting.findUnique({
        where: { key: "last-collection" },
      });
      const schedule = await operations.mutate(
        "schedule",
        () => ({
          lastCompletedAt: legacy?.value || null,
          lastAttemptAt: null as string | null,
          nextDueAt: new Date(
            (legacy ? Date.parse(legacy.value) : Date.now()) +
              settings.collectionIntervalHours * 36e5,
          ).toISOString(),
        }),
        (s) => s,
      );
      const active = (await operations.jobs()).some(
        (j) =>
          j.kind === "collection" &&
          ["queued", "running", "partial", "interrupted"].includes(j.status) &&
          j.nextRunAt !== null,
      );
      if (!stopped && !active && Date.parse(schedule.nextDueAt) <= Date.now()) {
        await operations.enqueue({
          scope: settings.nationwideEnabled ? "nationwide" : "regional",
          origin: "schedule",
        });
        await operations.mutate(
          "schedule",
          () => schedule,
          (s) => ({
            ...s,
            lastAttemptAt: new Date().toISOString(),
            nextDueAt: new Date(
              Date.now() + settings.collectionIntervalHours * 36e5,
            ).toISOString(),
          }),
        );
      }
      const job = !stopped ? await operations.nextJob() : null;
      if (job) {
        let cancelled = job.cancellationRequested;
        const jobHeartbeat = setInterval(
          () =>
            operations
              .heartbeat(job.id)
              .then((j) => {
                cancelled = j.cancellationRequested;
              })
              .catch(() => {
                stopped = true;
              }),
          1000,
        );
        try {
          if (job.kind === "geocode" || job.kind === "routes") {
            const geography = await import("./geography");
            const result =
              job.kind === "geocode"
                ? await geography.geocodeListings(job.limit || 20, {
                    shouldStop: () => stopped || cancelled,
                  })
                : await geography.routeListings(job.limit || 20, undefined, {
                    shouldStop: () => stopped || cancelled,
                  });
            const completion = serviceJobCompletion(result, stopped);
            await operations.finish(
              job.id,
              { ...result, operationNote: completion.note },
              completion.state,
              completion.nextRunAt,
            );
          } else {
            const result = await collect(job.scope, job.sourceId, {
              pageCap: job.pageCap,
              detailCap: job.detailCap,
              smoke: job.smoke,
              fresh: job.fresh,
              jobId: job.id,
              shouldStop: () => stopped || cancelled,
            });
            if (result.status === "finished") {
              await operations.mutate(
                "schedule",
                () => schedule,
                (s) => ({ ...s, lastCompletedAt: new Date().toISOString() }),
              );
              await db.setting.upsert({
                where: { key: "last-collection" },
                create: {
                  key: "last-collection",
                  value: new Date().toISOString(),
                },
                update: { value: new Date().toISOString() },
              });
            }
          }
        } catch (error) {
          // collect owns its own failure transition; service jobs transition here.
          if (job.kind !== "collection")
            await operations.failJob(job.id, error);
          console.error(`Job ${job.id} failed:`, (error as Error).message);
        } finally {
          clearInterval(jobHeartbeat);
        }
      }
      if (!stopped) {
        await evaluateAlerts();
        await deliverDigests();
      }
    } catch (error) {
      console.error("Worker cycle failed:", (error as Error).message);
    } finally {
      clearInterval(heartbeat);
      await lease.release();
    }
  }
  if (!stopped)
    await new Promise<void>((resolve) => {
      const timer = setTimeout(done, 10000);
      function done() {
        clearTimeout(timer);
        wake = undefined;
        resolve();
      }
      wake = done;
    });
}
await db.$disconnect();
