import { beforeAll, afterAll, it, expect } from "vitest";
import {
  mkdtempSync,
  readdirSync,
  existsSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { locationSchema, listingSchema } from "../shared/schema";
import { projectFreshness, projectSnapshot } from "../shared/freshness";
const folder = mkdtempSync(join(tmpdir(), "musclescout-geo-"));
process.env.DATABASE_URL = `file:${folder}/test.db`;
let db: (typeof import("../server/db"))["db"];
let geo: typeof import("../server/geography");
let store: typeof import("../server/store");
let budget: typeof import("../server/service-budget");
const home = locationSchema.parse({
  city: "Wheaton",
  state: "IL",
  lat: 41.86,
  lon: -88.11,
  precision: "city",
});
const loc = locationSchema.parse({ city: "Madison", state: "WI" });
const row = {
  lat: "43.07",
  lon: "-89.38",
  place_id: 12,
  addresstype: "city",
  address: {
    city: "Madison",
    state: "Wisconsin",
    country_code: "us",
    "ISO3166-2-lvl4": "US-WI",
  },
};
let now = Date.parse("2026-09-08T16:00:00Z");
const car = (id: string, location = loc) =>
  listingSchema.parse({
    id,
    sourceId: "fixture",
    sourceListingId: id,
    sourceName: "Fixture",
    url: `https://example.com/${id}`,
    title: "1969 Camaro",
    model: "Camaro",
    year: 1969,
    saleType: "fixed",
    availability: "active",
    askingPrice: 30000,
    seller: { name: "Fixture" },
    vehicleLocation: location,
    firstSeenAt: new Date(now).toISOString(),
    lastObservedAt: new Date(now).toISOString(),
  });
beforeAll(async () => {
  const Database = createRequire(import.meta.url)("better-sqlite3");
  const sqlite = new Database(`${folder}/test.db`);
  for (const d of readdirSync("prisma/migrations").sort()) {
    const f = `prisma/migrations/${d}/migration.sql`;
    if (existsSync(f)) sqlite.exec(readFileSync(f, "utf8"));
  }
  sqlite.close();
  ({ db } = await import("../server/db"));
  store = await import("../server/store");
  geo = await import("../server/geography");
  budget = await import("../server/service-budget");
  await store.saveSettings({ ...(await store.getSettings()), home });
});
afterAll(async () => {
  await db?.$disconnect();
  rmSync(folder, { recursive: true, force: true });
});
it("validates country, state, settlement type and matching city; retains evidence and refuses ambiguity", () => {
  const resolve = (r: unknown) =>
    geo.validateGeocoderResults(r, loc, new Date(now).toISOString(), "fixture");
  expect(resolve([row])).toMatchObject({
    lat: 43.07,
    lon: -89.38,
    evidence: {
      validatedAddress: true,
      state: "Wisconsin",
      featureType: "city",
    },
  });
  for (const bad of [
    { ...row, address: { ...row.address, country_code: "ca" } },
    {
      ...row,
      address: { ...row.address, state: "Illinois", "ISO3166-2-lvl4": "US-IL" },
    },
    { ...row, addresstype: "shop" },
    { ...row, lat: "" },
    { ...row, address: { ...row.address, city: "Other" } },
  ])
    expect(resolve([bad]).precision).toBe("ambiguous");
  expect(resolve([row, { ...row, lat: "44" }]).lat).toBeUndefined();
  expect(resolve([row, row]).lat).toBe(43.07);
});
it("serializes concurrent persistent reservations, enforces daily limits, and retains longest cooldown", async () => {
  const waits: number[] = [];
  const opts = {
    now: () => now,
    minIntervalMs: 10,
    dailyLimit: 3,
    sleep: async (ms: number) => {
      waits.push(ms);
    },
  };
  await Promise.all(
    [1, 2, 3].map(() => budget.reserveServiceRequest("fixture-budget", opts)),
  );
  expect(waits.sort((a, b) => a - b)).toEqual([10, 20]);
  await expect(
    budget.reserveServiceRequest("fixture-budget", opts),
  ).rejects.toThrow("Daily request budget");
  await budget.setServiceCooldown(
    "fixture-budget",
    new Date(now + 100000).toISOString(),
    "long",
  );
  await budget.setServiceCooldown(
    "fixture-budget",
    new Date(now + 1000).toISOString(),
    "short",
  );
  expect(
    (await budget.getServiceBudgets()).find(
      (b) => b.service === "fixture-budget",
    )?.cooldownUntil,
  ).toBe(new Date(now + 100000).toISOString());
  await expect(
    budget.reserveServiceRequest("fixture-budget", opts),
  ).rejects.toThrow();
});
it("moves ambiguous locations to review so one-item jobs reach later locations", async () => {
  await store.upsertListing(car("a", { ...loc, city: "Unclear" }));
  await store.upsertListing(car("b"));
  let calls = 0;
  const request = async (url: string) => {
    calls++;
    return {
      status: 200,
      headers: {},
      body: JSON.stringify(url.includes("Unclear") ? [] : [row]),
    };
  };
  await geo.geocodeListings(1, { request, now: () => now });
  now += 16000;
  await geo.geocodeListings(1, { request, now: () => now });
  now += 16000;
  await geo.geocodeListings(1, { request, now: () => now });
  expect(calls).toBe(2);
  expect(
    (await store.allListings()).find((l) => l.id === "a")?.vehicleLocation
      ?.precision,
  ).toBe("ambiguous");
  expect(
    (await store.allListings()).find((l) => l.id === "b")?.vehicleLocation?.lat,
  ).toBe(43.07);
  await geo.retryGeocode("a", "Reviewed municipality after inspecting source");
  expect(
    (await store.allListings()).find((l) => l.id === "a")?.vehicleLocation
      ?.precision,
  ).toBe("unknown");
  expect(await db.observation.count({ where: { kind: "geocode-retry" } })).toBe(
    1,
  );
});
it("uses fresh geocode cache and honors expiry, future guards and shared Retry-After", async () => {
  let calls = 0;
  const request = async () => {
    calls++;
    return { status: 200, headers: {}, body: JSON.stringify([row]) };
  };
  await geo.geocodeLocation(loc, { request, now: () => now });
  expect(calls).toBe(0);
  await store.saveSettings({
    ...(await store.getSettings()),
    geocodeCacheDays: 1,
  });
  now += 2 * 864e5;
  await geo.geocodeLocation(loc, { request, now: () => now });
  expect(calls).toBe(1);
  now += 16000;
  await db.geoCache.update({
    where: { key: geo.geocodeCacheKey(loc) },
    data: { observedAt: new Date(now + 864e5) },
  });
  await geo.geocodeLocation(loc, { request, now: () => now });
  expect(calls).toBe(2);
  now += 16000;
  await expect(
    geo.geocodeLocation(
      { ...loc, city: "New Place" },
      {
        request: async () => ({
          status: 429,
          headers: { "retry-after": "120" },
          body: "quota",
        }),
        now: () => now,
      },
    ),
  ).rejects.toThrow("429");
  await expect(
    geo.geocodeLocation(
      { ...loc, city: "Another" },
      { request, now: () => now },
    ),
  ).rejects.toThrow("429");
  expect(calls).toBe(2);
});
it("routes with explicit no-ferry/no-border options, exact duration, caller freshness and coordinate cache keys", async () => {
  process.env.MUSCLESCOUT_ORS_KEY = "fixture-never-sent";
  const destination = locationSchema.parse({
    ...loc,
    lat: 43.07,
    lon: -89.38,
    precision: "city",
  });
  let calls = 0;
  const request: NonNullable<
    import("../server/geography").RouteOptions["request"]
  > = async (_url, options) => {
    calls++;
    expect(JSON.parse(options!.body!).options).toEqual({
      avoid_features: ["ferries"],
      avoid_borders: "all",
    });
    return {
      status: 200,
      headers: {},
      body: JSON.stringify({
        routes: [{ summary: { duration: 14400, distance: 321868.8 } }],
      }),
    };
  };
  const first = await geo.openRouteService.route(home, destination, {
    request,
    now: () => now,
    maxAgeDays: 1,
  });
  expect(first).toMatchObject({ minutes: 240, miles: 200, traffic: false });
  await geo.openRouteService.route(home, destination, {
    request,
    now: () => now,
    maxAgeDays: 1,
  });
  expect(calls).toBe(1);
  now += 2 * 864e5;
  await geo.openRouteService.route(home, destination, {
    request,
    now: () => now,
    maxAgeDays: 1,
  });
  expect(calls).toBe(2);
  expect(geo.routeSignature(home, destination)).not.toBe(
    geo.routeSignature({ ...home, lat: 42 }, destination),
  );
  now += 2000;
  await expect(
    geo.openRouteService.route({ ...home, lat: 42 }, destination, {
      request: async () => ({
        status: 429,
        headers: { "retry-after": "60" },
        body: "quota",
      }),
      now: () => now,
    }),
  ).rejects.toThrow("429");
  await expect(
    geo.openRouteService.route({ ...home, lat: 42 }, destination, {
      request,
      now: () => now,
    }),
  ).rejects.toThrow("429");
  expect(calls).toBe(2);
  delete process.env.MUSCLESCOUT_ORS_KEY;
});
it("projects snapshot age at the exact boundary without losing original availability", () => {
  const listing = car("aged");
  const observed = Date.parse(listing.lastObservedAt);
  expect(
    projectFreshness(listing, 14, observed + 14 * 864e5).availability,
  ).toBe("active");
  const stale = projectFreshness(listing, 14, observed + 14 * 864e5 + 1);
  expect(stale.availability).toBe("stale");
  expect(stale.sourceAvailability).toBe("active");
  expect(projectFreshness(stale, 30, observed + 15 * 864e5).availability).toBe(
    "active",
  );
  expect(
    projectFreshness(
      { ...listing, availability: "sold" },
      14,
      observed + 100 * 864e5,
    ).availability,
  ).toBe("sold");
  expect(
    projectSnapshot(
      {
        schemaVersion: 1,
        generatedAt: listing.lastObservedAt,
        listings: [listing],
        coverage: [],
        runs: [],
        limitations: [],
        freshnessPolicy: { staleDays: 1 },
      },
      observed + 2 * 864e5,
    ).listings[0].availability,
  ).toBe("stale");
});
