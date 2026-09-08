import { createHash } from "node:crypto";
import { db } from "./db";
import { allListings, getSettings, getWorkspace } from "./store";
import { searchSchema, type Listing } from "../shared/schema";
import { searchListings } from "../shared/search";
import { safeRequest } from "./safe-fetch";
type Baseline = Record<
  string,
  {
    ask: number | null;
    bid: number | null;
    availability: string;
    observed: string;
    deadline: string | null;
  }
>;
export async function evaluateAlerts(force = false) {
  const listings = await allListings(),
    workspace = (await getWorkspace()).workspace,
    searches = await db.savedSearch.findMany();
  let created = 0;
  for (const saved of searches) {
    if (
      saved.schedule === "off" ||
      (!force &&
        saved.evaluatedAt &&
        Date.now() - saved.evaluatedAt.getTime() <
          (saved.schedule === "hourly" ? 36e5 : 864e5))
    )
      continue;
    const filters = searchSchema.parse(JSON.parse(saved.filters)),
      matches = searchListings(listings, filters, workspace).rows,
      previous: Baseline | null = saved.baseline
        ? JSON.parse(saved.baseline)
        : null,
      current: Baseline = {};
    for (const l of matches)
      current[l.id] = {
        ask: l.askingPrice,
        bid: l.currentBid,
        availability: l.availability,
        observed: l.lastObservedAt,
        deadline: l.auctionEnd,
      };
    if (previous) {
      const changes: { l: Listing; kind: string; message: string }[] = [];
      for (const l of matches) {
        const old = previous[l.id];
        if (!old)
          changes.push({
            l,
            kind: "new-match",
            message: `New match: ${l.title}`,
          });
        else if (
          l.saleType !== "auction" &&
          old.ask != null &&
          l.askingPrice != null &&
          Math.abs(l.askingPrice - old.ask) >= Math.max(250, old.ask * 0.01)
        )
          changes.push({
            l,
            kind: "asking-price",
            message: `Asking price changed: ${l.title}, $${old.ask.toLocaleString()} → $${l.askingPrice.toLocaleString()}`,
          });
        if (
          saved.bidAlerts &&
          l.saleType === "auction" &&
          old &&
          old.bid != null &&
          l.currentBid != null &&
          Math.abs(l.currentBid - old.bid) >= Math.max(250, old.bid * 0.01)
        )
          changes.push({
            l,
            kind: "bid-change",
            message: `Auction bid changed: ${l.title}, $${old.bid} → $${l.currentBid}`,
          });
        if (
          saved.deadlineAlerts &&
          l.auctionEnd &&
          Date.parse(l.auctionEnd) > Date.now() &&
          Date.parse(l.auctionEnd) - Date.now() <= 864e5
        )
          changes.push({
            l,
            kind: "auction-deadline",
            message: `Auction ends within 24 hours: ${l.title}`,
          });
      }
      for (const [id, old] of Object.entries(previous)) {
        const l = listings.find((x) => x.id === id);
        if (l && l.availability !== old.availability)
          changes.push({
            l,
            kind: "availability",
            message: `Availability changed: ${l.title} · ${l.availability}`,
          });
      }
      for (const c of changes) {
        const id = createHash("sha256")
          .update(
            c.kind === "auction-deadline"
              ? `${saved.id}:${c.l.id}:auction-deadline:${c.l.auctionEnd}`
              : `${saved.id}:${c.l.id}:${c.kind}:${c.l.lastObservedAt}:${c.kind === "bid-change" ? c.l.currentBid : c.l.askingPrice}:${c.l.availability}`,
          )
          .digest("hex");
        const exists = await db.alert.findUnique({ where: { id } });
        if (exists) continue;
        await db.alert.create({
          data: {
            id,
            searchId: saved.id,
            listingId: c.l.id,
            kind: c.kind,
            message: c.message,
          },
        });
        created++;
        if (saved.delivery !== "in-app")
          await db.deliveryAttempt.create({
            data: {
              id: `${id}:${saved.delivery}`,
              alertId: id,
              channel: saved.delivery,
              status: "pending",
              nextAttemptAt: new Date(),
            },
          });
      }
    }
    await db.savedSearch.update({
      where: { id: saved.id },
      data: { baseline: JSON.stringify(current), evaluatedAt: new Date() },
    });
  }
  return { created };
}
export async function deliverDigests() {
  const settings = await getSettings(),
    due = await db.deliveryAttempt.findMany({
      where: {
        status: { in: ["pending", "retry"] },
        nextAttemptAt: { lte: new Date() },
      },
    });
  for (const channel of ["webhook", "email"]) {
    const items = due.filter((d) => d.channel === channel);
    if (!items.length) continue;
    const enabled =
      channel === "webhook" ? settings.webhookEnabled : settings.emailEnabled;
    const destination =
      channel === "webhook"
        ? process.env.MUSCLESCOUT_WEBHOOK_URL
        : process.env.MUSCLESCOUT_EMAIL_TO;
    if (!enabled || !destination) {
      await db.deliveryAttempt.updateMany({
        where: { id: { in: items.map((x) => x.id) } },
        data: {
          status: "retry",
          error:
            "Delivery disabled or destination not configured. No message sent.",
          nextAttemptAt: new Date(Date.now() + 36e5),
        },
      });
      continue;
    }
    try {
      const alerts = await db.alert.findMany({
        where: { id: { in: items.map((x) => x.alertId) } },
      });
      if (channel === "webhook") {
        const result = await safeRequest(destination, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": createHash("sha256")
              .update(
                items
                  .map((i) => i.id)
                  .sort()
                  .join(","),
              )
              .digest("hex"),
          },
          body: JSON.stringify({
            application: "MuscleScout",
            kind: "digest",
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
          throw new Error(`Webhook HTTP ${result.status}`);
      } else {
        const smtp = process.env.MUSCLESCOUT_SMTP_URL;
        if (!smtp) throw new Error("SMTP not configured");
        const { default: nodemailer } = await import("nodemailer");
        await nodemailer.createTransport(smtp).sendMail({
          from:
            process.env.MUSCLESCOUT_EMAIL_FROM ||
            process.env.MUSCLESCOUT_EMAIL_TO,
          to: destination,
          subject: `MuscleScout · ${alerts.length} updates`,
          text: alerts.map((a) => a.message).join("\n"),
          messageId: `<${createHash("sha256")
            .update(
              items
                .map((i) => i.id)
                .sort()
                .join(","),
            )
            .digest("hex")}@musclescout.local>`,
        });
      }
      await db.deliveryAttempt.updateMany({
        where: { id: { in: items.map((x) => x.id) } },
        data: { status: "delivered", attempts: { increment: 1 }, error: null },
      });
    } catch (e) {
      for (const item of items)
        await db.deliveryAttempt.update({
          where: { id: item.id },
          data: {
            status: item.attempts >= 5 ? "failed" : "retry",
            attempts: { increment: 1 },
            error: (e as Error).message.replace(
              /https?:\/\/\S+/g,
              "[destination]",
            ),
            nextAttemptAt: new Date(
              Date.now() + Math.min(864e5, 60000 * 2 ** item.attempts),
            ),
          },
        });
    }
  }
  return { considered: due.length };
}
