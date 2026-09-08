import { createHash } from "node:crypto";
import { db } from "./db";
import { acquireLease, allListings, getSettings, getWorkspace } from "./store";
import { searchSchema } from "../shared/schema";
import { searchListings } from "../shared/search";
import {
  evaluateAlertPolicy,
  parseAlertBaseline,
  type AlertChange,
} from "../shared/alert-policy";
import { safeRequest } from "./safe-fetch";
import {
  deliveryBatchId,
  deliveryFailure,
  smtpTransportOptions,
} from "./delivery-policy";
import { reserveServiceRequest, ServiceBudgetError } from "./service-budget";

export function alertEventId(searchId: string, change: AlertChange) {
  const l = change.listing;
  const observation = ["new-match", "source-added"].includes(change.kind)
    ? l.firstSeenAt
    : change.kind === "auction-deadline"
      ? l.auctionEnd
      : `${l.lastObservedAt}:${change.kind === "bid-change" ? l.currentBid : l.askingPrice}:${l.availability}`;
  return createHash("sha256")
    .update(JSON.stringify([searchId, l.id, change.kind, observation]))
    .digest("hex");
}
export async function evaluateAlerts(force = false) {
  const lease = await acquireLease("alert-evaluation", 120);
  if (!lease) return { created: 0 };
  try {
    const listings = await allListings(),
      workspace = (await getWorkspace()).workspace,
      searches = await db.savedSearch.findMany();
    let created = 0;
    for (const saved of searches) {
      await lease.renew();
      if (
        saved.schedule === "off" ||
        (!force &&
          saved.evaluatedAt &&
          Date.now() - saved.evaluatedAt.getTime() <
            (saved.schedule === "hourly" ? 36e5 : 864e5))
      )
        continue;
      const filters = searchSchema.parse(JSON.parse(saved.filters));
      const { baseline, changes } = evaluateAlertPolicy({
        allListings: listings,
        matchingAds: searchListings(
          listings,
          { ...filters, grouped: false },
          workspace,
        ).rows,
        previous: parseAlertBaseline(saved.baseline),
        policy: filters.alertPolicy,
        crosspostAlerts: filters.crosspostAlerts,
        bidAlerts: saved.bidAlerts,
        deadlineAlerts: saved.deadlineAlerts,
      });
      await db.$transaction(async (tx) => {
        for (const change of changes) {
          const id = alertEventId(saved.id, change);
          if (await tx.alert.findUnique({ where: { id } })) continue;
          await tx.alert.create({
            data: {
              id,
              searchId: saved.id,
              listingId: change.listing.id,
              kind: change.kind,
              message: change.message,
            },
          });
          created++;
          if (saved.delivery !== "in-app")
            await tx.deliveryAttempt.create({
              data: {
                id: `${id}:${saved.delivery}`,
                alertId: id,
                channel: saved.delivery,
                status: "pending",
                nextAttemptAt: new Date(),
              },
            });
        }
        await tx.savedSearch.update({
          where: { id: saved.id },
          data: { baseline: JSON.stringify(baseline), evaluatedAt: new Date() },
        });
      });
    }
    return { created };
  } finally {
    await lease.release();
  }
}
type DeliveryBatch = {
  id: string;
  channel: "email" | "webhook";
  attemptIds: string[];
  createdAt: string;
  predecessorId?: string;
  retiredAt?: string;
  replacementId?: string | null;
  retirementReason?: string;
};
type DeliveryItem = Awaited<
  ReturnType<typeof db.deliveryAttempt.findMany>
>[number];
const batchKey = (id: string) => `delivery-batch:${id}`;
async function deliveryBatches() {
  return (
    await db.setting.findMany({
      where: { key: { startsWith: "delivery-batch:" } },
    })
  ).map((r) => JSON.parse(r.value) as DeliveryBatch);
}
async function currentDeliveryConsent(items: DeliveryItem[]) {
  const messages = await db.alert.findMany({
    where: { id: { in: items.map((item) => item.alertId) } },
  });
  const searches = await db.savedSearch.findMany({
    where: {
      id: { in: [...new Set(messages.map((message) => message.searchId))] },
    },
  });
  const byMessage = new Map(messages.map((message) => [message.id, message])),
    bySearch = new Map(searches.map((search) => [search.id, search]));
  return new Map(
    items.map((item) => {
      const message = byMessage.get(item.alertId),
        search = message && bySearch.get(message.searchId);
      let reason: string | null = null;
      if (!message || !search)
        reason = "The saved search or its alert was removed.";
      else if (search.schedule === "off")
        reason = "The saved search is disabled.";
      else if (search.delivery !== item.channel)
        reason = "The saved search no longer opts into this delivery channel.";
      else if (message.kind === "bid-change" && !search.bidAlerts)
        reason = "Bid-change delivery was disabled for this search.";
      else if (message.kind === "auction-deadline" && !search.deadlineAlerts)
        reason = "Auction-deadline delivery was disabled for this search.";
      else if (message.kind === "source-added") {
        const filters = searchSchema.safeParse(JSON.parse(search.filters));
        if (
          !filters.success ||
          filters.data.alertPolicy !== "vehicle" ||
          !filters.data.crosspostAlerts
        )
          reason = "Additional-source delivery was disabled for this search.";
      }
      return [item.id, reason] as const;
    }),
  );
}
async function cancelRevoked(
  items: DeliveryItem[],
  consent: Map<string, string | null>,
) {
  for (const item of items) {
    const reason = consent.get(item.id);
    if (reason && !["delivered", "cancelled"].includes(item.status))
      await db.deliveryAttempt.update({
        where: { id: item.id },
        data: {
          status: "cancelled",
          error: `Queued delivery cancelled: ${reason} An already accepted message cannot be recalled.`,
        },
      });
  }
}
/** Preserve the old immutable body/key and place allowed members in a new body/key. */
async function refreshBatchConsent(
  batch: DeliveryBatch,
  items: DeliveryItem[],
) {
  const consent = await currentDeliveryConsent(items);
  const removed = items.filter(
    (item) =>
      item.status !== "delivered" &&
      (item.status === "cancelled" || consent.get(item.id)),
  );
  if (!removed.length) return { batch, items };
  const allowed = items.filter(
    (item) =>
      !["delivered", "cancelled"].includes(item.status) &&
      !consent.get(item.id),
  );
  const replacement: DeliveryBatch | null = allowed.length
    ? {
        id: deliveryBatchId(
          batch.channel,
          allowed.map((item) => item.id),
        ),
        channel: batch.channel,
        attemptIds: allowed.map((item) => item.id).sort(),
        createdAt: new Date().toISOString(),
        predecessorId: batch.id,
      }
    : null;
  await db.$transaction(async (tx) => {
    for (const item of removed)
      if (item.status !== "cancelled")
        await tx.deliveryAttempt.update({
          where: { id: item.id },
          data: {
            status: "cancelled",
            error: `Queued delivery cancelled: ${consent.get(item.id)} An already accepted message cannot be recalled.`,
          },
        });
    const retired = {
      ...batch,
      retiredAt: new Date().toISOString(),
      replacementId: replacement?.id ?? null,
      retirementReason:
        "Search delivery consent changed. Original batch membership and key preserved; any eligible remainder has a distinct immutable replacement.",
    };
    await tx.setting.update({
      where: { key: batchKey(batch.id) },
      data: { value: JSON.stringify(retired) },
    });
    if (replacement) {
      await tx.setting.upsert({
        where: { key: batchKey(replacement.id) },
        create: {
          key: batchKey(replacement.id),
          value: JSON.stringify(replacement),
        },
        update: {},
      });
      for (const item of allowed)
        if (item.status === "uncertain")
          await tx.deliveryAttempt.update({
            where: { id: item.id },
            data: {
              error: `Earlier digest ${batch.id} may have been accepted. Revoked messages were excluded from replacement ${replacement.id}; retry may repeat the remaining alert IDs. Check the destination before acknowledging a retry.`,
            },
          });
    }
  });
  return { batch: replacement, items: allowed };
}
export async function retryDelivery(
  attemptId: string,
  acknowledgeUncertain = false,
) {
  const lease = await acquireLease("alert-delivery", 120);
  if (!lease)
    throw Object.assign(
      new Error(
        "A sender is currently processing deliveries; try again after it finishes.",
      ),
      { statusCode: 409 },
    );
  try {
    const attempt = await db.deliveryAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt)
      throw Object.assign(new Error("Delivery attempt not found."), {
        statusCode: 404,
      });
    let batch = (await deliveryBatches()).find(
      (b) => !b.retiredAt && b.attemptIds.includes(attemptId),
    );
    let items = await db.deliveryAttempt.findMany({
      where: { id: { in: batch?.attemptIds ?? [attemptId] } },
    });
    if (batch) {
      const checked = await refreshBatchConsent(batch, items);
      batch = checked.batch ?? undefined;
      items = checked.items;
    } else {
      const consent = await currentDeliveryConsent(items);
      await cancelRevoked(items, consent);
      items = items.filter(
        (item) => item.status !== "cancelled" && !consent.get(item.id),
      );
    }
    if (!items.some((item) => item.id === attemptId))
      throw Object.assign(
        new Error(
          "This queued delivery was cancelled because the saved search no longer opts in. Eligible messages from the former digest remain available separately.",
        ),
        { statusCode: 409 },
      );
    const ids = items.map((item) => item.id);
    if (
      items.some((i) => ["uncertain", "sending"].includes(i.status)) &&
      !acknowledgeUncertain
    )
      throw Object.assign(
        new Error(
          "The earlier send may have succeeded. Check the destination and explicitly acknowledge possible duplicate delivery before retrying the same digest.",
        ),
        { statusCode: 409 },
      );
    if (items.some((i) => i.status === "delivered"))
      throw Object.assign(
        new Error("This digest is already marked delivered."),
        { statusCode: 409 },
      );
    if (items.some((i) => i.status === "sending"))
      throw Object.assign(
        new Error(
          "A delivery is still in progress. Wait for completion or recovery.",
        ),
        { statusCode: 409 },
      );
    await db.$transaction(async (tx) => {
      await tx.setting.create({
        data: {
          key: `delivery-retry:${attemptId}:${Date.now()}`,
          value: JSON.stringify({
            attemptIds: ids,
            previous: items.map((i) => ({
              id: i.id,
              status: i.status,
              attempts: i.attempts,
            })),
            acknowledgeUncertain,
            reviewedAt: new Date().toISOString(),
          }),
        },
      });
      await tx.deliveryAttempt.updateMany({
        where: { id: { in: ids } },
        data: {
          status: "retry",
          attempts: 0,
          nextAttemptAt: new Date(),
          error:
            "User requested retry; original batch and receiver deduplication key retained.",
        },
      });
    });
    return { queued: ids.length, batchId: batch?.id ?? null };
  } finally {
    await lease.release();
  }
}
export async function deliverDigests() {
  const lease = await acquireLease("alert-delivery", 120);
  if (!lease) return { considered: 0, busy: true };
  try {
    // A previous process stopped after marking send-in-progress. Never guess it failed.
    await db.deliveryAttempt.updateMany({
      where: { status: "sending" },
      data: {
        status: "uncertain",
        error:
          "Previous sender stopped before recording its receipt. Review the destination before manual retry; the original deduplication key is retained.",
      },
    });
    const settings = await getSettings();
    // Include uncertain/blocked batches in consent reconciliation, but preserve
    // their send state: changing consent never grants an uncertain resend.
    for (const batch of (await deliveryBatches()).filter((b) => !b.retiredAt)) {
      const items = await db.deliveryAttempt.findMany({
        where: { id: { in: batch.attemptIds } },
      });
      if (
        items.some((item) => !["delivered", "cancelled"].includes(item.status))
      )
        await refreshBatchConsent(batch, items);
    }
    let due = await db.deliveryAttempt.findMany({
      where: {
        status: { in: ["pending", "retry"] },
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: 200,
    });
    const consent = await currentDeliveryConsent(due);
    await cancelRevoked(due, consent);
    due = due.filter((item) => !consent.get(item.id));
    const batches = (await deliveryBatches()).filter((b) => !b.retiredAt);
    const assigned = new Set(batches.flatMap((b) => b.attemptIds));
    for (const channel of ["webhook", "email"] as const) {
      const unassigned = due.filter(
        (i) => i.channel === channel && !assigned.has(i.id),
      );
      for (let offset = 0; offset < unassigned.length; offset += 50) {
        const attemptIds = unassigned
          .slice(offset, offset + 50)
          .map((i) => i.id)
          .sort();
        const batch: DeliveryBatch = {
          id: deliveryBatchId(channel, attemptIds),
          channel,
          attemptIds,
          createdAt: new Date().toISOString(),
        };
        await db.setting.upsert({
          where: { key: batchKey(batch.id) },
          create: { key: batchKey(batch.id), value: JSON.stringify(batch) },
          update: {},
        });
        batches.push(batch);
      }
    }
    const dueIds = new Set(due.map((i) => i.id));
    for (let batch of batches.filter((b) =>
      b.attemptIds.some((id) => dueIds.has(id)),
    )) {
      await lease.renew();
      let items = await db.deliveryAttempt.findMany({
        where: { id: { in: batch.attemptIds } },
      });
      // Consent may have changed while an earlier digest was in flight.
      const checked = await refreshBatchConsent(batch, items);
      if (!checked.batch) continue;
      batch = checked.batch;
      items = checked.items;
      if (
        items.some(
          (i) =>
            !["pending", "retry"].includes(i.status) ||
            i.nextAttemptAt.getTime() > Date.now(),
        )
      )
        continue;
      const enabled =
        batch.channel === "webhook"
          ? settings.webhookEnabled
          : settings.emailEnabled;
      const destination =
        batch.channel === "webhook"
          ? process.env.MUSCLESCOUT_WEBHOOK_URL
          : process.env.MUSCLESCOUT_EMAIL_TO;
      if (
        !enabled ||
        !destination ||
        (batch.channel === "email" && !process.env.MUSCLESCOUT_SMTP_URL)
      ) {
        await db.deliveryAttempt.updateMany({
          where: { id: { in: batch.attemptIds } },
          data: {
            status: "blocked",
            error:
              "Delivery is disabled or its destination/transport is not configured. No send attempted. Configure it, then explicitly retry.",
          },
        });
        continue;
      }
      // Production and synthetic checks share this persisted destination budget.
      // Reserving a slot never counts as a send attempt, even if consent changes while waiting.
      let service: string;
      try {
        const smtp =
          batch.channel === "email"
            ? smtpTransportOptions(process.env.MUSCLESCOUT_SMTP_URL!)
            : null;
        service = smtp
          ? `smtp://${smtp.host}:${smtp.port}`
          : new URL(destination).origin;
      } catch {
        await db.deliveryAttempt.updateMany({
          where: { id: { in: batch.attemptIds } },
          data: {
            status: "blocked",
            error:
              "Delivery destination or transport configuration is invalid. No send attempted. Correct it, then explicitly retry.",
          },
        });
        continue;
      }
      try {
        await reserveServiceRequest(service, {
          minIntervalMs: 1000,
          dailyLimit: 100,
          maxWaitMs: 10000,
        });
      } catch (error) {
        if (!(error instanceof ServiceBudgetError)) throw error;
        await db.deliveryAttempt.updateMany({
          where: { id: { in: batch.attemptIds } },
          data: {
            status: "retry",
            nextAttemptAt: new Date(error.retryAfterAt),
            error:
              "Shared delivery request budget deferred this digest. No send attempted.",
          },
        });
        continue;
      }
      await lease.renew();
      // The reservation may wait. Re-read both per-search and global opt-in afterward.
      const afterWait = await refreshBatchConsent(
        batch,
        await db.deliveryAttempt.findMany({
          where: { id: { in: batch.attemptIds } },
        }),
      );
      if (!afterWait.batch) continue;
      batch = afterWait.batch;
      items = afterWait.items;
      const currentSettings = await getSettings();
      if (
        !(batch.channel === "webhook"
          ? currentSettings.webhookEnabled
          : currentSettings.emailEnabled)
      ) {
        await db.deliveryAttempt.updateMany({
          where: { id: { in: batch.attemptIds } },
          data: {
            status: "blocked",
            error:
              "Delivery was disabled while waiting for its request slot. No send attempted. Enable it, then explicitly retry.",
          },
        });
        continue;
      }
      const alerts = await db.alert.findMany({
        where: { id: { in: items.map((i) => i.alertId) } },
        orderBy: { id: "asc" },
      });
      await db.deliveryAttempt.updateMany({
        where: { id: { in: batch.attemptIds } },
        data: { status: "sending", attempts: { increment: 1 }, error: null },
      });
      try {
        if (batch.channel === "webhook") {
          const result = await safeRequest(destination, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": batch.id,
            },
            body: JSON.stringify({
              application: "MuscleScout",
              kind: "digest",
              id: batch.id,
              alerts: alerts.map((a) => ({
                id: a.id,
                message: a.message,
                kind: a.kind,
                createdAt: a.createdAt,
              })),
            }),
            maxBytes: 500000,
          });
          if (result.status < 200 || result.status >= 300)
            throw Object.assign(new Error("Webhook rejected digest."), {
              statusCode: result.status,
            });
        } else {
          const { default: nodemailer } = await import("nodemailer");
          const transport = nodemailer.createTransport(
            smtpTransportOptions(process.env.MUSCLESCOUT_SMTP_URL!),
          );
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const result = await Promise.race([
              transport.sendMail({
                from:
                  process.env.MUSCLESCOUT_EMAIL_FROM ||
                  process.env.MUSCLESCOUT_EMAIL_TO,
                to: destination,
                subject: `MuscleScout · ${alerts.length} updates`,
                text: alerts
                  .map((a) => `${a.message}\nAlert ID: ${a.id}`)
                  .join("\n\n"),
                messageId: `<${batch.id}@musclescout.local>`,
                headers: { "X-MuscleScout-Digest-ID": batch.id },
              }),
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                  transport.close();
                  reject(
                    Object.assign(new Error("SMTP deadline elapsed."), {
                      uncertain: true,
                    }),
                  );
                }, 30000);
              }),
            ]);
            if (result.rejected?.length)
              throw Object.assign(
                new Error(
                  "SMTP rejected one or more recipients; partial delivery is possible.",
                ),
                { uncertain: true },
              );
          } finally {
            if (timer) clearTimeout(timer);
            transport.close();
          }
        }
        await db.deliveryAttempt.updateMany({
          where: { id: { in: batch.attemptIds } },
          data: { status: "delivered", error: null },
        });
      } catch (error) {
        for (const item of items)
          await db.deliveryAttempt.update({
            where: { id: item.id },
            data: deliveryFailure(error, item.attempts + 1),
          });
      }
    }
    return { considered: due.length };
  } finally {
    await lease.release();
  }
}
