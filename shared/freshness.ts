import type { Listing, Snapshot } from "./schema";

export function observedAvailability(
  listing: Listing,
): Listing["availability"] {
  return listing.sourceAvailability || listing.availability;
}
export function projectFreshness(
  listing: Listing,
  staleDays = 14,
  now = Date.now(),
  auctionMaxAgeHours = 6,
): Listing {
  const sourceAvailability = observedAvailability(listing);
  const elapsed = now - Date.parse(listing.lastObservedAt);
  const stale = Number.isFinite(elapsed) && elapsed > staleDays * 864e5;
  let availability = sourceAvailability;
  if (
    listing.saleType === "auction" &&
    !["sold", "removed"].includes(sourceAvailability)
  ) {
    if (listing.auctionEnd && Date.parse(listing.auctionEnd) <= now)
      availability = "auction-ended";
    else if (
      Number.isFinite(elapsed) &&
      elapsed > auctionMaxAgeHours * 36e5 &&
      ["live-auction", "upcoming-auction", "active"].includes(
        sourceAvailability,
      )
    )
      availability = "stale";
    else if (
      sourceAvailability === "upcoming-auction" &&
      listing.auctionStart &&
      Date.parse(listing.auctionStart) <= now &&
      listing.auctionEnd &&
      Date.parse(listing.auctionEnd) > now
    )
      availability = "live-auction";
  } else if (stale && ["active", "unknown"].includes(sourceAvailability))
    availability = "stale";
  return { ...listing, sourceAvailability, availability };
}
export function projectSnapshot(
  snapshot: Snapshot,
  now = Date.now(),
): Snapshot {
  return {
    ...snapshot,
    listings: snapshot.listings.map((l) =>
      projectFreshness(
        l,
        snapshot.freshnessPolicy?.staleDays ?? 14,
        now,
        snapshot.freshnessPolicy?.auctionMaxAgeHours ?? 6,
      ),
    ),
  };
}
