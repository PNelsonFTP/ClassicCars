import "dotenv/config";
import { db } from "./db";
import { collect } from "./ingest/collector";
import { getSettings, acquireLease } from "./store";
import { evaluateAlerts, deliverDigests } from "./alerts";
let stopped = false;
for (const s of ["SIGINT", "SIGTERM"] as const)
  process.on(s, () => {
    stopped = true;
  });
console.log(
  "MuscleScout worker running. Geocoding stays explicit; external delivery stays disabled unless configured.",
);
while (!stopped) {
  const lease = await acquireLease("musclescout-worker-cycle", 1800);
  if (lease) {
    const heartbeat = setInterval(
      () =>
        lease.renew().catch(() => {
          stopped = true;
        }),
      30000,
    );
    try {
      const request = await db.setting.findUnique({
          where: { key: "collection-request" },
        }),
        settings = await getSettings(),
        last = await db.setting.findUnique({
          where: { key: "last-collection" },
        });
      if (
        request ||
        (last &&
          Date.now() - Date.parse(last.value) >
            settings.collectionIntervalHours * 36e5)
      ) {
        const scope = request
          ? JSON.parse(request.value).scope
          : settings.nationwideEnabled
            ? "nationwide"
            : "regional";
        const result = await collect(scope, undefined, {
          shouldStop: () => stopped,
        });
        if (result.status !== "busy") {
          if (request)
            await db.setting.deleteMany({
              where: { key: "collection-request", value: request.value },
            });
          await db.setting.upsert({
            where: { key: "last-collection" },
            create: { key: "last-collection", value: new Date().toISOString() },
            update: { value: new Date().toISOString() },
          });
        }
      }
      await evaluateAlerts();
      await deliverDigests();
    } catch (e) {
      console.error("Worker cycle failed:", (e as Error).message);
    } finally {
      clearInterval(heartbeat);
      await lease.release();
    }
  }
  await new Promise((r) => setTimeout(r, 10000));
}
await db.$disconnect();
