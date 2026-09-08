import type { Listing, Location } from "./schema";
const normalized = (value: string | undefined) =>
  (value ?? "").normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
export function locationAddressKey(location: Location | null): string {
  if (!location) return "unknown";
  return JSON.stringify(
    [location.city, location.state, location.country, location.postalCode]
      .map(normalized)
      .concat(String(location.offsite)),
  );
}
function routeLocationKey(location: Location | null): string {
  return JSON.stringify([
    locationAddressKey(location),
    location?.lat ?? null,
    location?.lon ?? null,
    ["unknown", "ambiguous"].includes(location?.precision || "unknown")
      ? "unresolved"
      : "known",
  ]);
}
/** Source text and derived geographic evidence have separate lifecycles. */
export function mergeVehicleGeography(
  old: Listing,
  incoming: Listing,
  detail: boolean,
) {
  const overrides = incoming.userOverrides || old.userOverrides;
  let vehicleLocation =
    overrides && Object.hasOwn(overrides, "vehicleLocation")
      ? (overrides.vehicleLocation ?? null)
      : detail
        ? incoming.vehicleLocation
        : incoming.vehicleLocation || old.vehicleLocation;
  const previous = old.vehicleLocation;
  if (
    vehicleLocation &&
    previous &&
    locationAddressKey(vehicleLocation) === locationAddressKey(previous) &&
    !vehicleLocation.offsite &&
    vehicleLocation.precision !== "ambiguous" &&
    vehicleLocation.lat == null &&
    vehicleLocation.lon == null &&
    previous.lat != null &&
    previous.lon != null
  ) {
    // A parser repeating "Wheaton, IL" is not evidence that a validated point disappeared.
    vehicleLocation = {
      ...vehicleLocation,
      lat: previous.lat,
      lon: previous.lon,
      provider: previous.provider,
      observedAt: previous.observedAt,
      evidence: previous.evidence,
      precision: previous.precision,
    };
  }
  const changed =
    routeLocationKey(previous) !== routeLocationKey(vehicleLocation);
  const requestedRoute = incoming.route;
  // Carrying the previous object through a local update does not prove it routes a new address.
  const route =
    changed && JSON.stringify(requestedRoute) === JSON.stringify(old.route)
      ? null
      : (requestedRoute ?? (changed ? null : old.route));
  return {
    vehicleLocation,
    route,
    straightLineMiles:
      changed && incoming.straightLineMiles === old.straightLineMiles
        ? null
        : (incoming.straightLineMiles ??
          (changed ? null : old.straightLineMiles)),
  };
}
