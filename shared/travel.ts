import type { Listing, Search } from "./schema";
import {
  DEFAULT_ORIGIN,
  ROAD_PROFILE,
  normalizePlaceName,
  placeKey,
  type Place,
  type TravelAtlas,
  type ListingTravel,
} from "./travel-contract";
export { DEFAULT_ORIGIN, placeKey } from "./travel-contract";
const stateKey = (city: string, state: string) =>
  `${state.toUpperCase()}:${normalizePlaceName(city)}`;
export function createPlaceIndex(places: Place[]) {
  const index = new Map<string, Place[]>();
  for (const p of places) {
    // Postal rows support explicit ZIP selection, not an arbitrary city centroid.
    if (p.kind === "postal") continue;
    for (const name of new Set([p.city, ...p.aliases])) {
      const key = stateKey(name, p.state),
        rows = index.get(key) || [];
      if (!rows.some((x) => x.id === p.id)) index.set(key, [...rows, p]);
    }
  }
  return index;
}
export function resolvePlace(
  location:
    { city: string; state: string; country?: string } | null | undefined,
  index: ReturnType<typeof createPlaceIndex>,
): Place | null {
  if (!location || (location.country && location.country !== "US")) return null;
  const candidates = index.get(stateKey(location.city, location.state)) || [];
  const preferred = candidates.filter((p) => p.kind === "place");
  const rows = preferred.length ? preferred : candidates;
  return rows.length === 1 ? rows[0] : null;
}
export function isOffsite(l: Listing) {
  if (l.userOverrides?.vehicleLocation)
    return l.userOverrides.vehicleLocation.offsite;
  return (
    !!l.vehicleLocation?.offsite ||
    l.locationDisclosure?.status === "offsite" ||
    (!l.vehicleLocation &&
      (/off.?site|owner.?s? home|client.?s? home/i.test(l.routeUnknownReason) ||
        l.flags.includes("Off-site vehicle location unknown")))
  );
}
export function resolveListingTravel(
  l: Listing,
  atlas: TravelAtlas,
  index = createPlaceIndex(atlas.places),
): ListingTravel {
  if (isOffsite(l))
    return {
      basis: "offsite",
      place: null,
      estimates: [],
      reason:
        "The seller says this vehicle is elsewhere. Confirm its actual city.",
    };
  if (
    l.vehicleLocation &&
    ["ambiguous", "region"].includes(l.vehicleLocation.precision)
  )
    return {
      basis: "ambiguous",
      place: null,
      estimates: [],
      reason:
        "Reported vehicle location is ambiguous or regional; confirm its city.",
    };
  const loc = l.vehicleLocation || l.seller.location;
  const basis = l.vehicleLocation
    ? l.userOverrides?.vehicleLocation ||
      l.locationDisclosure?.status === "reviewed-vehicle"
      ? "reviewed-location"
      : "vehicle-city"
    : "advertised-city";
  const place = resolvePlace(loc, index);
  if (!place)
    return {
      basis: loc ? "ambiguous" : "unknown",
      place: null,
      estimates: [],
      reason: loc
        ? "City needs review; no unique local place match."
        : "No usable city has been reported.",
    };
  const estimates = atlas.estimates.filter(
    (e) =>
      e.destinationId === place.id &&
      e.graphVersion === atlas.graph.version &&
      e.graphObservedAt === atlas.graph.observedAt &&
      e.profile === atlas.graph.profile &&
      e.destinationPoint[0] === place.lon &&
      e.destinationPoint[1] === place.lat &&
      atlas.origins.some(
        (p) =>
          placeKey(p) === e.originKey &&
          p.lon === e.originPoint[0] &&
          p.lat === e.originPoint[1],
      ),
  );
  return {
    basis,
    place,
    estimates,
    reason:
      atlas.unresolved[place.id] ||
      (basis === "advertised-city"
        ? "Trip to advertised city; confirm where the vehicle is kept."
        : "City-level vehicle location; traffic-free road estimate."),
  };
}
export function projectTravel(listings: Listing[], atlas?: TravelAtlas) {
  if (!atlas) return listings.map((l) => ({ ...l, travel: undefined }));
  const index = createPlaceIndex(atlas.places);
  return listings.map((l) => ({
    ...l,
    travel: resolveListingTravel(l, atlas, index),
  }));
}
export function routeEvidenceKnown(
  l: Listing,
  now = Date.now(),
  maxAgeDays = 30,
  originKey = DEFAULT_ORIGIN,
) {
  const r = l.route,
    loc = l.vehicleLocation;
  if (
    !r ||
    !loc ||
    loc.country !== "US" ||
    isOffsite(l) ||
    ["unknown", "ambiguous", "region"].includes(loc.precision)
  )
    return false;
  const parseLabel = (s: string) => {
    const [city, state] = s.split(",").map((x) => x.trim());
    return city && state ? placeKey({ city, state }) : "";
  };
  const context = r.context;
  return (
    !!context &&
    context.originKey === originKey &&
    context.profile === ROAD_PROFILE &&
    context.destinationPoint[0] === loc.lon &&
    context.destinationPoint[1] === loc.lat &&
    parseLabel(r.origin) === originKey &&
    parseLabel(r.destination) === placeKey(loc) &&
    !r.traffic &&
    Number.isFinite(r.minutes) &&
    r.minutes >= 0 &&
    Date.parse(r.observedAt) <= now &&
    now - Date.parse(r.observedAt) <= maxAgeDays * 864e5
  );
}
export type TravelResult = {
  status: "within" | "borderline" | "outside" | "unknown";
  minutes: number | null;
  low: number | null;
  high: number | null;
  label: string;
  basis: string;
  reason: string;
};
export function travelResult(
  l: Listing,
  s: Search,
  now = Date.now(),
): TravelResult {
  const unknown = (reason: string): TravelResult => ({
    status: "unknown",
    minutes: null,
    low: null,
    high: null,
    label: "Travel estimate unavailable",
    basis: l.travel?.basis || "unknown",
    reason,
  });
  if (isOffsite(l))
    return unknown(
      "Actual vehicle city needs confirmation; dealer travel does not qualify.",
    );
  const t = l.travel,
    e = t?.estimates.find(
      (e) =>
        e.originKey === s.originKey &&
        e.destinationId === t.place?.id &&
        e.profile === ROAD_PROFILE &&
        e.destinationPoint[0] === t.place.lon &&
        e.destinationPoint[1] === t.place.lat,
    );
  let minutes: number, basis: string;
  if (
    e &&
    t?.place &&
    (t.basis !== "advertised-city" ||
      (s.travelMode !== "strict" && s.allowAdvertisedLocation))
  ) {
    if (
      [e.computedAt, e.graphObservedAt].some(
        (date) =>
          Date.parse(date) > now ||
          now - Date.parse(date) > s.travelMaxAgeDays * 864e5,
      ) ||
      Math.max(e.originSnapMeters, e.destinationSnapMeters) > 2500
    )
      return unknown(
        "Road data is stale or the city point is too far from a routable road.",
      );
    minutes = e.minutes;
    basis = t.basis;
  } else if (routeEvidenceKnown(l, now, s.routeMaxAgeDays, s.originKey)) {
    minutes = l.route!.minutes;
    basis = "vehicle-city";
  } else {
    if (e && t?.basis === "advertised-city")
      return unknown(
        "Advertised-city estimate excluded by your location preference.",
      );
    if (t?.place && !e)
      return unknown(
        `No road estimate for this starting city and destination. ${t.reason}`,
      );
    return unknown(
      t?.reason ||
        (l.vehicleLocation
          ? "Vehicle city recorded; a matching-origin road estimate is still needed."
          : "No usable vehicle or advertised city estimate."),
    );
  }
  const margin =
    s.travelMode === "strict"
      ? 0
      : Math.max(
          s.planningBuffer === "conservative" ? 30 : 15,
          minutes * (s.planningBuffer === "conservative" ? 0.2 : 0.1),
        );
  const low =
      s.planningBuffer === "conservative" || s.travelMode === "strict"
        ? minutes
        : // The stock car profile already reduces tagged speeds; allow for model variance
          // without altering the real road baseline or implying traffic calibration.
          Math.max(0, minutes - Math.max(15, minutes * 0.2)),
    high = minutes + margin;
  const status =
    high <= s.maxMinutes
      ? "within"
      : low <= s.maxMinutes
        ? "borderline"
        : "outside";
  const round = (m: number) =>
    m < 60
      ? `${Math.max(15, Math.round(m / 15) * 15)} min`
      : `${Math.round(m / 30) / 2}h`;
  const from = round(low),
    to = round(high);
  const label =
    high < 15
      ? "Under 15 min drive"
      : s.travelMode === "strict"
        ? `~${round(minutes)} drive`
        : from === to
          ? `About ${to} drive`
          : `About ${from}–${to} drive`;
  return {
    status,
    minutes,
    low,
    high,
    label,
    basis,
    reason:
      basis === "advertised-city"
        ? "To advertised city · confirm vehicle location"
        : "To reported vehicle city · no live traffic",
  };
}
export function travelEligible(l: Listing, s: Search, now = Date.now()) {
  const r = travelResult(l, s, now);
  return (
    r.status === "within" || (r.status === "borderline" && s.includeBorderline)
  );
}
export function tripDestination(l: Listing) {
  return isOffsite(l)
    ? null
    : l.travel?.place || l.vehicleLocation || l.seller.location;
}
export function travelQuality(
  listings: Listing[],
  s: Search,
  now = Date.now(),
) {
  const counts = {
    vehicleCities: 0,
    advertisedCities: 0,
    ambiguous: 0,
    offsite: 0,
    estimates: 0,
    within: 0,
    borderline: 0,
    unknown: 0,
    nearbyAwaitingDetail: 0,
  };
  for (const l of listings) {
    if (l.vehicleLocation?.city.trim() && l.vehicleLocation.state.trim())
      counts.vehicleCities++;
    if (l.seller.location?.city.trim() && l.seller.location.state.trim())
      counts.advertisedCities++;
    if (l.travel?.basis === "ambiguous") counts.ambiguous++;
    if (isOffsite(l)) counts.offsite++;
    const r = travelResult(l, s, now);
    if (r.minutes != null) counts.estimates++;
    if (r.status === "within") counts.within++;
    if (r.status === "borderline") counts.borderline++;
    if (r.status === "unknown") counts.unknown++;
    if (
      (r.status === "within" ||
        (r.status === "borderline" && s.includeBorderline)) &&
      !l.lastDetailObservedAt &&
      !l.parserVersion.includes("detail")
    )
      counts.nearbyAwaitingDetail++;
  }
  return counts;
}
