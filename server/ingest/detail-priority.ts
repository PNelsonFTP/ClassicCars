import { DEFAULT_ORIGIN } from "../../shared/travel-contract";
import type { Listing } from "../../shared/schema";
import { defaultSearch } from "../../shared/schema";
import { travelResult } from "../../shared/travel";
import type { DetailTask } from "./operations";
/** Three relevance choices then one oldest task: nearby work advances without starving the rest. */
export function prioritizeDetails(
  tasks: DetailTask[],
  listings: Map<string, Listing>,
  favorites: string[] = [],
  originKey = DEFAULT_ORIGIN,
) {
  const favorite = new Set(favorites),
    s = { ...defaultSearch(), originKey };
  const score = (t: DetailTask) => {
    const l = listings.get(t.listingId);
    if (!l) return 0;
    const minutes = travelResult(l, s).minutes;
    return (
      (favorite.has(l.id) ? 100 : 0) +
      (t.catalogChanged ? 30 : 0) +
      (minutes != null && minutes <= 360 ? 20 : 0) +
      (!l.vehicleLocation ? 3 : 0) +
      (l.askingPrice == null ? 2 : 0)
    );
  };
  const ranked = [...tasks].sort((a, b) => score(b) - score(a)),
    oldest = [...tasks],
    seen = new Set<string>(),
    result: DetailTask[] = [];
  while (result.length < tasks.length) {
    const list = result.length % 4 === 3 ? oldest : ranked;
    while (list.length && seen.has(list[0].listingId)) list.shift();
    const next = list.shift();
    if (!next) continue;
    seen.add(next.listingId);
    result.push(next);
  }
  return result;
}

/** Only facts which can make detail review useful; observation timestamps alone do not dirty a task. */
export function catalogDetailSignature(l: Listing) {
  return JSON.stringify([
    l.model,
    l.year,
    l.askingPrice,
    l.priceOnRequest,
    l.stockNumber,
    l.identifier,
    l.sourceAvailability || l.availability,
    l.vehicleLocation?.city,
    l.vehicleLocation?.state,
    l.vehicleLocation?.offsite,
    l.seller.location?.city,
    l.seller.location?.state,
  ]);
}
