import type { Listing } from "./schema";
export type AlertPolicy = "vehicle" | "ad";
export type AlertAdState = {
  ask: number | null;
  bid: number | null;
  availability: string;
  observed: string;
  deadline: string | null;
  groupId: string | null;
};
export type AlertBaseline = {
  version: 2;
  policy: AlertPolicy;
  ads: Record<string, AlertAdState>;
  evaluatedAt: string;
};
export type AlertChange = {
  listing: Listing;
  kind:
    | "new-match"
    | "source-added"
    | "asking-price"
    | "bid-change"
    | "auction-deadline"
    | "availability";
  message: string;
};
export function parseAlertBaseline(value: string | null): AlertBaseline | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed.version === 2 && parsed.ads && typeof parsed.ads === "object"
      ? parsed
      : null;
  } catch {
    return null;
  }
}
const adState = (l: Listing): AlertAdState => ({
  ask: l.askingPrice,
  bid: l.currentBid,
  availability: l.availability,
  observed: l.lastObservedAt,
  deadline: l.auctionEnd,
  groupId: l.groupId,
});
const changedPrice = (old: number | null, value: number | null) =>
  old != null &&
  value != null &&
  Math.abs(value - old) >= Math.max(250, old * 0.01);

/** Match all ads (grouped:false) before calling. Group policy never uses the display representative. */
export function evaluateAlertPolicy(input: {
  allListings: Listing[];
  matchingAds: Listing[];
  previous: AlertBaseline | null;
  policy?: AlertPolicy;
  crosspostAlerts?: boolean;
  bidAlerts?: boolean;
  deadlineAlerts?: boolean;
  now?: Date;
}) {
  const { allListings, matchingAds } = input,
    policy = input.policy ?? "vehicle",
    now = input.now ?? new Date();
  // A policy change or v1 migration establishes a quiet, explicit baseline.
  const previous = input.previous?.policy === policy ? input.previous : null;
  const baseline: AlertBaseline = {
      version: 2,
      policy,
      ads: { ...(previous?.ads ?? {}) },
      evaluatedAt: now.toISOString(),
    },
    changes: AlertChange[] = [];
  const listingsById = new Map(allListings.map((l) => [l.id, l]));
  const knownGroups = new Set<string>();
  for (const id of Object.keys(previous?.ads ?? {})) {
    // Follow current membership via durable ad IDs through merge/unmerge transitions.
    const current = listingsById.get(id);
    if (current?.groupId) knownGroups.add(current.groupId);
    // A detached ad no longer establishes identity for the group it left.
    if (current) baseline.ads[id] = adState(current);
  }
  const matches = [...matchingAds].sort((a, b) => a.id.localeCompare(b.id));
  for (const l of matches) {
    const old = previous?.ads[l.id];
    if (previous && !old) {
      const knownVehicle = !!l.groupId && knownGroups.has(l.groupId);
      if (policy === "ad" || !knownVehicle)
        changes.push({
          listing: l,
          kind: "new-match",
          message: `New ${policy === "ad" ? "source ad" : "vehicle match"}: ${l.title}`,
        });
      else if (input.crosspostAlerts)
        changes.push({
          listing: l,
          kind: "source-added",
          message: `Additional source for a known vehicle: ${l.title} · ${l.sourceName}. This source's asking price is tracked separately.`,
        });
    }
    if (
      previous &&
      old &&
      l.saleType !== "auction" &&
      changedPrice(old.ask, l.askingPrice)
    )
      changes.push({
        listing: l,
        kind: "asking-price",
        message: `Source asking price changed: ${l.title} · ${l.sourceName}, $${old.ask!.toLocaleString()} → $${l.askingPrice!.toLocaleString()}`,
      });
    if (
      previous &&
      old &&
      input.bidAlerts &&
      l.saleType === "auction" &&
      changedPrice(old.bid, l.currentBid)
    )
      changes.push({
        listing: l,
        kind: "bid-change",
        message: `Auction bid changed: ${l.title} · ${l.sourceName}, $${old.bid} → $${l.currentBid}`,
      });
    if (
      previous &&
      input.deadlineAlerts &&
      l.auctionEnd &&
      Date.parse(l.auctionEnd) > now.getTime() &&
      Date.parse(l.auctionEnd) - now.getTime() <= 864e5
    )
      changes.push({
        listing: l,
        kind: "auction-deadline",
        message: `Auction ends within 24 hours: ${l.title} · ${l.sourceName}`,
      });
    if (l.groupId) knownGroups.add(l.groupId);
    baseline.ads[l.id] = adState(l);
  }
  if (previous)
    for (const [id, old] of Object.entries(previous.ads)) {
      const l = listingsById.get(id);
      if (l && l.availability !== old.availability)
        changes.push({
          listing: l,
          kind: "availability",
          message: `Source availability changed: ${l.title} · ${l.sourceName} · ${l.availability}`,
        });
    }
  return { baseline, changes };
}
