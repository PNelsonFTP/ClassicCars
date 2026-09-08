import { createHash } from "node:crypto";
import { db } from "./db";
import { allListings, getSettings, upsertListing } from "./store";
import { locationSchema, type Location, type Listing } from "../shared/schema";
import { safeRequest, throttled, agent } from "./safe-fetch";
export function haversine(a: Location, b: Location) {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null)
    return null;
  const rad = Math.PI / 180,
    dlat = (b.lat - a.lat) * rad,
    dlon = (b.lon - a.lon) * rad;
  return (
    3958.7613 *
    2 *
    Math.atan2(
      Math.sqrt(
        Math.sin(dlat / 2) ** 2 +
          Math.cos(a.lat * rad) *
            Math.cos(b.lat * rad) *
            Math.sin(dlon / 2) ** 2,
      ),
      Math.sqrt(
        1 -
          (Math.sin(dlat / 2) ** 2 +
            Math.cos(a.lat * rad) *
              Math.cos(b.lat * rad) *
              Math.sin(dlon / 2) ** 2),
      ),
    )
  );
}
export async function geocodeLocation(location: Location): Promise<Location> {
  if (location.offsite || location.precision === "ambiguous") return location;
  const provider =
    process.env.MUSCLESCOUT_GEOCODER_URL ||
    "https://nominatim.openstreetmap.org";
  const query = `${location.city}, ${location.state}, United States`,
    key = `geo:${provider}:${query}`;
  const cached = await db.geoCache.findUnique({ where: { key } });
  if (cached) return locationSchema.parse(JSON.parse(cached.payload));
  const contact = process.env.MUSCLESCOUT_GEOCODER_CONTACT;
  const url = `${provider}/search?format=jsonv2&city=${encodeURIComponent(location.city)}&state=${encodeURIComponent(location.state)}&country=United+States&countrycodes=us&addressdetails=1&limit=3`;
  const result = await throttled(url, 15000, {
    headers: {
      "User-Agent": `${agent}${contact ? " contact: " + contact : ""}`,
    },
  });
  if (result.status !== 200) throw new Error(`Geocoder HTTP ${result.status}`);
  const rows = JSON.parse(result.body);
  const unique = [
    ...new Map(
      rows.map((r: { lat: string; lon: string; display_name: string }) => [
        `${Number(r.lat).toFixed(2)}:${Number(r.lon).toFixed(2)}`,
        r,
      ]),
    ).values(),
  ] as { lat: string; lon: string }[];
  const observedAt = new Date().toISOString();
  const resolved = locationSchema.parse({
    ...location,
    ...(unique.length === 1
      ? {
          lat: Number(unique[0].lat),
          lon: Number(unique[0].lon),
          precision: "city",
        }
      : { lat: undefined, lon: undefined, precision: "ambiguous" }),
    provider,
    observedAt,
  });
  await db.geoCache.upsert({
    where: { key },
    create: {
      key,
      provider,
      payload: JSON.stringify(resolved),
      observedAt: new Date(observedAt),
    },
    update: {
      payload: JSON.stringify(resolved),
      observedAt: new Date(observedAt),
    },
  });
  return resolved;
}
export async function geocodeListings(limit = 20) {
  const settings = await getSettings();
  if (settings.home.lat == null) {
    settings.home = await geocodeLocation(settings.home);
    await db.setting.upsert({
      where: { key: "settings" },
      create: { key: "settings", value: JSON.stringify(settings) },
      update: { value: JSON.stringify(settings) },
    });
  }
  let processed = 0;
  for (const l of await allListings()) {
    if (processed >= limit) break;
    if (
      !l.vehicleLocation ||
      l.vehicleLocation.offsite ||
      l.vehicleLocation.lat != null
    )
      continue;
    const location = await geocodeLocation(l.vehicleLocation);
    await upsertListing({
      ...l,
      vehicleLocation: location,
      ...(l.userOverrides?.vehicleLocation
        ? { userOverrides: { ...l.userOverrides, vehicleLocation: location } }
        : {}),
      straightLineMiles: haversine(settings.home, location),
      routeUnknownReason:
        location.precision === "ambiguous"
          ? "Location could not be unambiguously geocoded; please correct it."
          : "Geocode established; routing credential or route enrichment still required.",
    });
    processed++;
  }
  return { processed, home: settings.home };
}
export interface RoutingProvider {
  name: string;
  route(origin: Location, destination: Location): Promise<Listing["route"]>;
}
export const openRouteService: RoutingProvider = {
  name: "openrouteservice",
  async route(origin, destination) {
    const key = process.env.MUSCLESCOUT_ORS_KEY;
    if (!key) return null;
    if (
      origin.lat == null ||
      origin.lon == null ||
      destination.lat == null ||
      destination.lon == null ||
      destination.offsite
    )
      return null;
    const options = { avoid_features: ["ferries"], avoid_borders: "all" },
      signature = JSON.stringify({
        origin: [origin.lon, origin.lat],
        destination: [destination.lon, destination.lat],
        profile: "driving-car",
        options,
        provider: "openrouteservice",
      }),
      cacheKey = `route:${createHash("sha256").update(signature).digest("hex")}`;
    const cached = await db.geoCache.findUnique({ where: { key: cacheKey } });
    if (cached && Date.now() - cached.observedAt.getTime() < 30 * 864e5)
      return JSON.parse(cached.payload);
    const result = await throttled(
      "https://api.openrouteservice.org/v2/directions/driving-car/json",
      1600,
      {
        method: "POST",
        headers: { Authorization: key, "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: [
            [origin.lon, origin.lat],
            [destination.lon, destination.lat],
          ],
          options,
        }),
      },
    );
    if (result.status !== 200)
      throw new Error(
        `Routing provider HTTP ${result.status}; no substitute estimate used.`,
      );
    const summary = JSON.parse(result.body).routes?.[0]?.summary;
    if (
      !summary ||
      typeof summary.duration !== "number" ||
      typeof summary.distance !== "number"
    )
      throw new Error("Invalid routing response");
    const route = {
      minutes: summary.duration / 60,
      miles: summary.distance / 1609.344,
      provider: "openrouteservice",
      observedAt: new Date().toISOString(),
      origin: `${origin.city}, ${origin.state}`,
      destination: `${destination.city}, ${destination.state}`,
      options: JSON.stringify(options),
      traffic: false,
      precision: destination.precision,
    };
    await db.geoCache.upsert({
      where: { key: cacheKey },
      create: {
        key: cacheKey,
        provider: "openrouteservice",
        payload: JSON.stringify(route),
        observedAt: new Date(),
      },
      update: { payload: JSON.stringify(route), observedAt: new Date() },
    });
    return route;
  },
};
export async function routeListings(
  limit = 30,
  provider: RoutingProvider = openRouteService,
) {
  if (provider === openRouteService && !process.env.MUSCLESCOUT_ORS_KEY)
    return {
      processed: 0,
      reason:
        "MUSCLESCOUT_ORS_KEY is not configured. All driving times remain unavailable.",
    };
  const settings = await getSettings();
  let processed = 0;
  for (const l of await allListings()) {
    if (processed >= limit) break;
    if (
      (l.route &&
        l.route.provider === provider.name &&
        Date.now() - Date.parse(l.route.observedAt) <
          settings.routeMaxAgeDays * 864e5) ||
      !l.vehicleLocation ||
      l.vehicleLocation.lat == null ||
      l.vehicleLocation.lon == null ||
      l.vehicleLocation.offsite ||
      ["unknown", "ambiguous"].includes(l.vehicleLocation.precision)
    )
      continue;
    const route = await provider.route(settings.home, l.vehicleLocation);
    if (route) {
      await upsertListing({
        ...l,
        route,
        straightLineMiles: haversine(settings.home, l.vehicleLocation),
      });
      processed++;
    }
  }
  return { processed };
}
