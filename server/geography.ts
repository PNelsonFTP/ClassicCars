import { createHash } from "node:crypto";
import { db } from "./db";
import {
  allListings,
  getSettings,
  upsertListing,
  acquireLease,
  saveSettings,
} from "./store";
import { locationSchema, type Location, type Listing } from "../shared/schema";
import { safeRequest, agent } from "./safe-fetch";
import {
  reserveServiceRequest,
  setServiceCooldown,
  ServiceBudgetError,
} from "./service-budget";

export function haversine(a: Location, b: Location) {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null)
    return null;
  const rad = Math.PI / 180,
    dlat = (b.lat - a.lat) * rad,
    dlon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dlon / 2) ** 2;
  return (
    3958.7613 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
  );
}
const states = Object.fromEntries(
  "AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming"
    .split("|")
    .map((pair) => pair.split(":")),
);
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function geocodeCacheKey(
  location: Location,
  provider = process.env.MUSCLESCOUT_GEOCODER_URL ||
    "https://nominatim.openstreetmap.org",
) {
  return `geo:v2:${provider.replace(/\/$/, "")}:${normalize(location.city)}:${location.state.toUpperCase()}:US`;
}
type GeoRow = {
  lat?: string;
  lon?: string;
  place_id?: number | string;
  display_name?: string;
  type?: string;
  addresstype?: string;
  address?: Record<string, string>;
};
export function validateGeocoderResults(
  rows: unknown,
  location: Location,
  observedAt: string,
  provider: string,
): Location {
  if (!Array.isArray(rows)) throw new Error("Invalid geocoder response");
  const valid = rows.filter((row: GeoRow) => {
    const address = row.address || {},
      state = location.state.toUpperCase();
    const actualState =
      address["ISO3166-2-lvl4"]?.toUpperCase() || address.state;
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.hamlet ||
      address.suburb ||
      address.borough;
    const kind = row.addresstype || row.type;
    return (
      address.country_code?.toLowerCase() === "us" &&
      (actualState === `US-${state}` ||
        normalize(actualState || "") === normalize(states[state] || state)) &&
      !!city &&
      normalize(city) === normalize(location.city) &&
      [
        "city",
        "town",
        "village",
        "municipality",
        "hamlet",
        "suburb",
        "borough",
        "quarter",
      ].includes(kind || "") &&
      typeof row.lat === "string" &&
      !!row.lat.trim() &&
      typeof row.lon === "string" &&
      !!row.lon.trim() &&
      Number.isFinite(Number(row.lat)) &&
      Number.isFinite(Number(row.lon)) &&
      Math.abs(Number(row.lat)) <= 90 &&
      Math.abs(Number(row.lon)) <= 180
    );
  }) as GeoRow[];
  const unique = [
    ...new Map(
      valid.map((row) => [
        `${Number(row.lat).toFixed(4)}:${Number(row.lon).toFixed(4)}`,
        row,
      ]),
    ).values(),
  ];
  const row = unique.length === 1 ? unique[0] : null;
  return locationSchema.parse({
    ...location,
    lat: row ? Number(row.lat) : undefined,
    lon: row ? Number(row.lon) : undefined,
    precision: row ? "city" : "ambiguous",
    provider,
    observedAt,
    evidence: row
      ? {
          placeId: String(row.place_id ?? ""),
          label: row.display_name,
          countryCode: row.address?.country_code,
          state: row.address?.state || row.address?.["ISO3166-2-lvl4"],
          featureType: row.addresstype || row.type,
          validatedAddress: true,
        }
      : { validatedAddress: false },
  });
}
function retryAt(headers: Record<string, unknown>, now: number) {
  const value = String(headers["retry-after"] || "");
  const seconds = Number(value);
  if (value && Number.isFinite(seconds))
    return new Date(now + Math.max(0, seconds) * 1000).toISOString();
  const date = Date.parse(value);
  return new Date(
    Number.isFinite(date) && date > now ? date : now + 3600000,
  ).toISOString();
}
async function checkResponse(
  status: number,
  headers: Record<string, unknown>,
  service: string,
  now: number,
) {
  if ([403, 429, 503].includes(status)) {
    const until = retryAt(headers, now);
    await setServiceCooldown(
      service,
      until,
      `Provider HTTP ${status}; requests paused.`,
    );
    throw new ServiceBudgetError(
      `Provider HTTP ${status}; no substitute result used.`,
      until,
    );
  }
  if (status !== 200)
    throw new Error(`Provider HTTP ${status}; no substitute result used.`);
}
export async function geocodeLocation(
  location: Location,
  options: {
    force?: boolean;
    request?: typeof safeRequest;
    now?: () => number;
  } = {},
): Promise<Location> {
  if (
    location.offsite ||
    (location.precision === "ambiguous" && !options.force)
  )
    return location;
  if (
    location.country !== "US" ||
    !location.city.trim() ||
    !states[location.state.toUpperCase()]
  )
    return {
      ...location,
      lat: undefined,
      lon: undefined,
      precision: "ambiguous",
    };
  const settings = await getSettings(),
    clock = options.now || Date.now;
  const provider = (
      process.env.MUSCLESCOUT_GEOCODER_URL ||
      "https://nominatim.openstreetmap.org"
    ).replace(/\/$/, ""),
    key = geocodeCacheKey(location, provider);
  const cached = await db.geoCache.findUnique({ where: { key } });
  if (
    !options.force &&
    cached &&
    clock() >= cached.observedAt.getTime() &&
    clock() - cached.observedAt.getTime() <= settings.geocodeCacheDays * 864e5
  )
    return locationSchema.parse(JSON.parse(cached.payload));
  await reserveServiceRequest(new URL(provider).origin, {
    minIntervalMs: 15000,
    dailyLimit: settings.geocodeDailyLimit,
    now: clock,
  });
  const contact = process.env.MUSCLESCOUT_GEOCODER_CONTACT;
  const result = await (options.request || safeRequest)(
    `${provider}/search?format=jsonv2&city=${encodeURIComponent(location.city)}&state=${encodeURIComponent(location.state)}&country=United+States&countrycodes=us&addressdetails=1&limit=5`,
    {
      headers: {
        "User-Agent": `${agent}${contact ? " contact: " + contact : ""}`,
      },
    },
  );
  await checkResponse(
    result.status,
    result.headers,
    new URL(provider).origin,
    clock(),
  );
  const observedAt = new Date(clock()).toISOString();
  const resolved = validateGeocoderResults(
    JSON.parse(result.body),
    location,
    observedAt,
    provider,
  );
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
async function withGeoLease<T>(
  name: string,
  action: (renew: () => Promise<void>) => Promise<T>,
) {
  const lease = await acquireLease(name, 180);
  if (!lease)
    throw new Error(
      "Another geography job is running. Its shared lease prevents overlapping provider requests.",
    );
  let lost = false;
  const timer = setInterval(
    () =>
      lease.renew().catch(() => {
        lost = true;
      }),
    30000,
  );
  try {
    return await action(async () => {
      if (lost) throw new Error("Geography lease lost");
      await lease.renew();
    });
  } finally {
    clearInterval(timer);
    await lease.release();
  }
}
export async function geocodeListings(
  limit = 20,
  options: {
    shouldStop?: () => boolean;
    request?: typeof safeRequest;
    now?: () => number;
  } = {},
) {
  return withGeoLease("musclescout-geocode", async (renew) => {
    const settings = await getSettings();
    if (
      (settings.home.lat == null || settings.home.lon == null) &&
      !options.shouldStop?.()
    ) {
      const home = await geocodeLocation(settings.home, options);
      if (home.lat == null)
        return {
          processed: 0,
          reviewNeeded: 1,
          reason:
            "Home location needs explicit review before listing geocoding.",
          home,
        };
      settings.home = home;
      await saveSettings(settings);
    }
    const all = await allListings();
    const pending = all.filter(
      (l) =>
        l.vehicleLocation &&
        !l.vehicleLocation.offsite &&
        l.vehicleLocation.precision !== "ambiguous" &&
        (l.vehicleLocation.lat == null || l.vehicleLocation.lon == null),
    );
    const attempts = new Map(
      (
        await db.setting.findMany({
          where: { key: { startsWith: "geo-attempt:" } },
        })
      ).map((row) => [row.key.slice(12), row.value]),
    );
    pending.sort((a, b) =>
      (attempts.get(a.id) || "").localeCompare(attempts.get(b.id) || ""),
    );
    let processed = 0;
    const errors: { id: string; message: string }[] = [];
    for (const l of pending.slice(0, Math.max(0, limit))) {
      if (options.shouldStop?.()) break;
      await renew();
      const key = `geo-attempt:${l.id}`,
        value = new Date((options.now || Date.now)()).toISOString();
      await db.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
      try {
        const location = await geocodeLocation(l.vehicleLocation!, options);
        await upsertListing({
          ...l,
          vehicleLocation: location,
          ...(l.userOverrides?.vehicleLocation
            ? {
                userOverrides: {
                  ...l.userOverrides,
                  vehicleLocation: location,
                },
              }
            : {}),
          route: null,
          straightLineMiles: haversine(settings.home, location),
          routeUnknownReason:
            location.precision === "ambiguous"
              ? "Geocoder address evidence is ambiguous or conflicting; review the location."
              : "Validated city location; driving route still required.",
        });
        processed++;
      } catch (e) {
        errors.push({ id: l.id, message: (e as Error).message });
        if (e instanceof ServiceBudgetError) break;
      }
    }
    return {
      processed,
      remaining: Math.max(0, pending.length - processed),
      reviewNeeded: all.filter(
        (l) =>
          !l.vehicleLocation ||
          l.vehicleLocation.precision === "ambiguous" ||
          l.vehicleLocation.offsite,
      ).length,
      errors,
      home: settings.home,
    };
  });
}
export async function retryGeocode(id: string, reason: string) {
  if (reason.trim().length < 5)
    throw new Error("Explain the reviewed location or retry reason.");
  const row = await db.listing.findUniqueOrThrow({ where: { id } });
  const l = JSON.parse(row.payload) as Listing;
  if (!l.vehicleLocation || l.vehicleLocation.offsite)
    throw new Error("Establish the actual vehicle location before retrying.");
  await db.geoCache.deleteMany({
    where: { key: geocodeCacheKey(l.vehicleLocation) },
  });
  const location = {
    ...l.vehicleLocation,
    lat: undefined,
    lon: undefined,
    precision: "unknown" as const,
  };
  await db.$transaction(async (tx) => {
    await tx.listing.update({
      where: { id },
      data: {
        driveMinutes: null,
        payload: JSON.stringify({
          ...l,
          vehicleLocation: location,
          route: null,
          straightLineMiles: null,
          ...(l.userOverrides?.vehicleLocation
            ? {
                userOverrides: {
                  ...l.userOverrides,
                  vehicleLocation: location,
                },
              }
            : {}),
        }),
      },
    });
    await tx.observation.create({
      data: {
        listingId: id,
        kind: "geocode-retry",
        observedAt: new Date(),
        payload: JSON.stringify({ reason, previous: l.vehicleLocation }),
      },
    });
    await tx.setting.deleteMany({ where: { key: `geo-attempt:${id}` } });
  });
  return { queuedForNextExplicitGeocode: true, id };
}
export type RouteOptions = {
  maxAgeDays?: number;
  now?: () => number;
  request?: typeof safeRequest;
};
export interface RoutingProvider {
  name: string;
  route(
    origin: Location,
    destination: Location,
    options?: RouteOptions,
  ): Promise<Listing["route"]>;
}
const routingOptions = { avoid_features: ["ferries"], avoid_borders: "all" };
export function routeSignature(
  origin: Location,
  destination: Location,
  provider = "openrouteservice",
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        origin: [origin.lon, origin.lat],
        destination: [destination.lon, destination.lat],
        profile: "driving-car",
        options: routingOptions,
        provider,
        traffic: false,
      }),
    )
    .digest("hex");
}
export const openRouteService: RoutingProvider = {
  name: "openrouteservice",
  async route(origin, destination, options = {}) {
    const key = process.env.MUSCLESCOUT_ORS_KEY;
    if (
      !key ||
      origin.lat == null ||
      origin.lon == null ||
      destination.lat == null ||
      destination.lon == null ||
      destination.offsite ||
      destination.country !== "US"
    )
      return null;
    const clock = options.now || Date.now,
      signature = routeSignature(origin, destination),
      cacheKey = `route:${signature}`;
    const cached = await db.geoCache.findUnique({ where: { key: cacheKey } });
    const maxAgeDays =
      options.maxAgeDays ?? (await getSettings()).routeMaxAgeDays;
    if (
      cached &&
      clock() >= cached.observedAt.getTime() &&
      clock() - cached.observedAt.getTime() <= maxAgeDays * 864e5
    )
      return JSON.parse(cached.payload);
    const service = "https://api.openrouteservice.org";
    await reserveServiceRequest(service, {
      minIntervalMs: 1600,
      dailyLimit: (await getSettings()).routingDailyLimit,
      now: clock,
    });
    const result = await (options.request || safeRequest)(
      `${service}/v2/directions/driving-car/json`,
      {
        method: "POST",
        headers: { Authorization: key, "Content-Type": "application/json" },
        body: JSON.stringify({
          coordinates: [
            [origin.lon, origin.lat],
            [destination.lon, destination.lat],
          ],
          options: routingOptions,
        }),
      },
    );
    await checkResponse(result.status, result.headers, service, clock());
    const summary = JSON.parse(result.body).routes?.[0]?.summary;
    if (
      !summary ||
      !Number.isFinite(summary.duration) ||
      !Number.isFinite(summary.distance) ||
      summary.duration < 0 ||
      summary.distance < 0
    )
      throw new Error("Invalid routing response");
    const route = {
      minutes: summary.duration / 60,
      miles: summary.distance / 1609.344,
      provider: "openrouteservice",
      observedAt: new Date(clock()).toISOString(),
      origin: `${origin.city}, ${origin.state}`,
      destination: `${destination.city}, ${destination.state}`,
      options: JSON.stringify(routingOptions),
      inputSignature: signature,
      traffic: false,
      precision: destination.precision,
    };
    await db.geoCache.upsert({
      where: { key: cacheKey },
      create: {
        key: cacheKey,
        provider: service,
        payload: JSON.stringify(route),
        observedAt: new Date(clock()),
      },
      update: { payload: JSON.stringify(route), observedAt: new Date(clock()) },
    });
    return route;
  },
};
export async function routeListings(
  limit = 30,
  provider: RoutingProvider = openRouteService,
  options: RouteOptions & { shouldStop?: () => boolean } = {},
) {
  if (provider === openRouteService && !process.env.MUSCLESCOUT_ORS_KEY)
    return {
      processed: 0,
      reason:
        "MUSCLESCOUT_ORS_KEY is not configured. Driving times remain unavailable.",
    };
  return withGeoLease("musclescout-routes", async (renew) => {
    const settings = await getSettings(),
      clock = options.now || Date.now;
    if (
      settings.home.lat == null ||
      settings.home.lon == null ||
      settings.home.precision === "ambiguous"
    )
      return {
        processed: 0,
        reason: "Establish the home location before routing.",
      };
    const candidates = (await allListings()).filter((l) => {
      const loc = l.vehicleLocation,
        age = l.route ? clock() - Date.parse(l.route.observedAt) : Infinity;
      const compatible =
        provider !== openRouteService ||
        l.route?.inputSignature ===
          routeSignature(settings.home, loc || settings.home);
      return (
        loc &&
        loc.lat != null &&
        loc.lon != null &&
        loc.country === "US" &&
        !loc.offsite &&
        !["unknown", "ambiguous"].includes(loc.precision) &&
        !(
          l.route?.provider === provider.name &&
          compatible &&
          age >= 0 &&
          age <= settings.routeMaxAgeDays * 864e5
        )
      );
    });
    const attempts = new Map(
      (
        await db.setting.findMany({
          where: { key: { startsWith: "route-attempt:" } },
        })
      ).map((row) => [row.key.slice(14), row.value]),
    );
    candidates.sort((a, b) =>
      (attempts.get(a.id) || "").localeCompare(attempts.get(b.id) || ""),
    );
    let processed = 0;
    const errors: { id: string; message: string }[] = [];
    for (const l of candidates.slice(0, Math.max(0, limit))) {
      if (options.shouldStop?.()) break;
      await renew();
      const key = `route-attempt:${l.id}`,
        value = new Date(clock()).toISOString();
      await db.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
      try {
        const route = await provider.route(settings.home, l.vehicleLocation!, {
          ...options,
          maxAgeDays: settings.routeMaxAgeDays,
        });
        if (route) {
          await upsertListing({
            ...l,
            route,
            straightLineMiles: haversine(settings.home, l.vehicleLocation!),
          });
          processed++;
        }
      } catch (e) {
        errors.push({ id: l.id, message: (e as Error).message });
        if (e instanceof ServiceBudgetError) break;
      }
    }
    return {
      processed,
      remaining: Math.max(0, candidates.length - processed),
      errors,
    };
  });
}
