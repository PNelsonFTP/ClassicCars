import { afterAll, beforeAll, describe, it, expect } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { listingSchema, defaultSearch, emptyWorkspace } from "../shared/schema";
const folder = mkdtempSync(join(tmpdir(), "musclescout-test-"));
process.env.DATABASE_URL = `file:${folder}/isolated.db`;
process.env.MUSCLESCOUT_PASSWORD = "isolated-test-password";
let db: (typeof import("../server/db"))["db"],
  store: typeof import("../server/store"),
  api: Awaited<ReturnType<(typeof import("../server/api"))["buildApi"]>>,
  token: string;
const now = new Date().toISOString();
const car = (id = "test-car", extra: Record<string, unknown> = {}) =>
  listingSchema.parse({
    id,
    sourceId: "fixture",
    sourceName: "Fixture dealer",
    sourceListingId: id,
    url: "https://example.com/cars/" + id,
    title: "1969 Chevrolet Camaro",
    model: "Camaro",
    make: "Chevrolet",
    year: 1969,
    askingPrice: 30000,
    saleType: "fixed",
    availability: "active",
    seller: { name: "Fixture dealer", type: "dealer" },
    firstSeenAt: now,
    lastObservedAt: now,
    vehicleLocation: {
      city: "Wheaton",
      state: "IL",
      country: "US",
      precision: "city",
    },
    ...extra,
  });
const auth = () => ({
  authorization: `Bearer ${token}`,
  origin: "http://127.0.0.1:3100",
});
beforeAll(async () => {
  const Database = createRequire(import.meta.url)("better-sqlite3");
  const sqlite = new Database(`${folder}/isolated.db`);
  for (const d of readdirSync("prisma/migrations").sort()) {
    const f = "prisma/migrations/" + d + "/migration.sql";
    if (existsSync(f)) sqlite.exec(readFileSync(f, "utf8"));
  }
  sqlite.close();
  ({ db } = await import("../server/db"));
  store = await import("../server/store");
  api = await (await import("../server/api")).buildApi();
  const response = await api.inject({
    method: "POST",
    url: "/api/login",
    payload: { password: "isolated-test-password" },
  });
  token = response.json().token;
});
afterAll(async () => {
  await api?.close();
  await db?.$disconnect();
  rmSync(folder, { recursive: true, force: true });
});
describe("authenticated isolated backend", () => {
  it("requires auth and an exact allowed Origin, and rejects unsafe import URLs", async () => {
    expect((await api.inject("/api/snapshot")).statusCode).toBe(401);
    expect(
      (
        await api.inject({
          url: "/api/snapshot",
          headers: { ...auth(), origin: "https://evil.example" },
        })
      ).statusCode,
    ).toBe(403);
    const bad = await api.inject({
      method: "POST",
      url: "/api/import",
      headers: auth(),
      payload: { listings: [{ ...car(), url: "javascript:alert(1)" }] },
    });
    expect(bad.json()).toMatchObject({ accepted: 0 });
    expect(bad.json().rejected).toHaveLength(1);
  });
  it("preserves first tracking and changes price history only on changed observed asks", async () => {
    await store.upsertListing(car());
    await store.upsertListing(car());
    expect(await db.observation.count({ where: { kind: "ask" } })).toBe(1);
    const later = new Date(Date.now() + 1000).toISOString();
    const updated = await store.upsertListing(
      car("test-car", {
        askingPrice: 28000,
        firstSeenAt: later,
        lastObservedAt: later,
      }),
    );
    expect(updated.firstSeenAt).toBe(now);
    expect(await db.observation.count({ where: { kind: "ask" } })).toBe(2);
    expect(await db.observation.count({ where: { kind: "bid" } })).toBe(0);
  });
  it("does not resurrect an old route after explicit off-site detail evidence", () => {
    const old = car("offsite", {
      parserVersion: "fixture-detail-v1",
      route: {
        minutes: 60,
        miles: 50,
        provider: "fixture",
        observedAt: now,
        origin: "Wheaton, IL",
        destination: "Wheaton, IL",
        options: "none",
        precision: "city",
      },
    });
    const incoming = car("offsite", {
      parserVersion: "fixture-detail-v1",
      vehicleLocation: null,
      route: null,
      flags: ["Off-site vehicle location unknown"],
    });
    expect(store.mergeObservation(old, incoming)).toMatchObject({
      vehicleLocation: null,
      route: null,
    });
  });
  it("baselines imported stock quietly then makes idempotent price and availability alerts", async () => {
    const { evaluateAlerts } = await import("../server/alerts");
    const filters = { ...defaultSearch(), mode: "nationwide" as const };
    await db.savedSearch.create({
      data: {
        id: "search",
        name: "Nationwide",
        filters: JSON.stringify(filters),
        defaultsVersion: 1,
        schedule: "daily",
      },
    });
    expect(await evaluateAlerts(true)).toEqual({ created: 0 });
    await store.upsertListing(
      car("test-car", {
        askingPrice: 24000,
        lastObservedAt: new Date(Date.now() + 2000).toISOString(),
      }),
    );
    expect(await evaluateAlerts(true)).toEqual({ created: 1 });
    expect(await evaluateAlerts(true)).toEqual({ created: 0 });
    await store.upsertListing(
      car("test-car", {
        askingPrice: 24000,
        availability: "sold",
        lastObservedAt: new Date(Date.now() + 3000).toISOString(),
      }),
    );
    expect(await evaluateAlerts(true)).toEqual({ created: 1 });
    expect((await db.alert.findMany()).map((a) => a.kind).sort()).toEqual([
      "asking-price",
      "availability",
    ]);
  });
  it("merges imports without losing notes and enforces workspace revisions", async () => {
    const workspace = {
      ...emptyWorkspace(),
      favorites: ["test-car"],
      notes: { "test-car": "Inspect floor pans; private note" },
    };
    const saved = await api.inject({
      method: "PUT",
      url: "/api/workspace",
      headers: auth(),
      payload: { workspace, revision: 0 },
    });
    expect(saved.json().revision).toBe(1);
    await api.inject({
      method: "POST",
      url: "/api/import",
      headers: auth(),
      payload: { listings: [car()] },
    });
    expect((await store.getWorkspace()).workspace.notes["test-car"]).toContain(
      "floor pans",
    );
    expect(
      (
        await api.inject({
          method: "PUT",
          url: "/api/workspace",
          headers: auth(),
          payload: { workspace, revision: 0 },
        })
      ).statusCode,
    ).toBe(409);
  });
  it("preserves personal state through reviewed merge and unmerge", async () => {
    await store.upsertListing(car("second"));
    const r = await api.inject({
      method: "POST",
      url: "/api/groups/merge",
      headers: auth(),
      payload: {
        ids: ["test-car", "second"],
        reason: "User reviewed identical car documentation",
      },
    });
    expect(r.statusCode).toBe(200);
    const groupId = r.json().groupId;
    expect(
      (await store.allListings()).filter((l) => l.groupId === groupId),
    ).toHaveLength(2);
    expect(
      (await store.getWorkspace()).workspace.notes["test-car"],
    ).toBeTruthy();
    await api.inject({
      method: "POST",
      url: "/api/groups/unmerge",
      headers: auth(),
      payload: { groupId },
    });
    expect(
      (await store.allListings()).filter((l) => l.groupId === groupId),
    ).toHaveLength(0);
  });
  it("shares search logic and records broader collection demand independently", async () => {
    const filters = {
      ...defaultSearch(),
      mode: "unknown-route" as const,
      availability: [],
    };
    const response = await api.inject({
      method: "POST",
      url: "/api/search",
      headers: auth(),
      payload: filters,
    });
    const { searchListings } = await import("../shared/search");
    expect(response.json().rows.map((r: { id: string }) => r.id)).toEqual(
      searchListings(await store.allListings(), filters).rows.map((l) => l.id),
    );
    await api.inject({
      method: "POST",
      url: "/api/collection/expand",
      headers: auth(),
      payload: {},
    });
    expect((await store.getSettings()).nationwideEnabled).toBe(true);
    expect(
      JSON.parse(
        (await db.setting.findUnique({ where: { key: "collection-request" } }))!
          .value,
      ).scope,
    ).toBe("nationwide");
  });
  it("enforces renewable exclusive leases and expiry recovery", async () => {
    const first = await store.acquireLease("fixture-lease");
    expect(first).not.toBeNull();
    expect(await store.acquireLease("fixture-lease")).toBeNull();
    await first!.renew();
    await db.lease.update({
      where: { name: "fixture-lease" },
      data: { expiresAt: new Date(0) },
    });
    const recovered = await store.acquireLease("fixture-lease");
    expect(recovered?.owner).not.toBe(first?.owner);
    await first!.release();
    expect(await store.acquireLease("fixture-lease")).toBeNull();
    await recovered!.release();
  });
  it("redacts private identifiers, raw evidence and workspace from snapshots", async () => {
    await store.upsertListing(
      car("private", {
        identifier: "12345678901234567",
        evidenceRef: "data/private-page.html",
        originalSellerText: "Private source evidence",
        description: "Contact person@example.com or 312-555-0123",
      }),
    );
    const snapshot = await store.snapshot(true);
    const text = JSON.stringify(snapshot);
    expect(text).not.toContain("12345678901234567");
    expect(text).not.toContain("data/private-page.html");
    expect(text).not.toContain("floor pans");
    expect(text).not.toContain("person@example.com");
    expect(snapshot.listings.every((l) => !l.isSample)).toBe(true);
  });
  it("invalidates routes when the user corrects vehicle or home location", async () => {
    const corrected = await api.inject({
      method: "PATCH",
      url: "/api/listings/test-car/location",
      headers: auth(),
      payload: {
        city: "Madison",
        state: "WI",
        precision: "city",
        lat: 43.0748,
        lon: -89.3848,
      },
    });
    expect(corrected.statusCode).toBe(200);
    expect(corrected.json().route).toBeNull();
    expect(corrected.json().vehicleLocation.city).toBe("Madison");
  });
  it("retains detailed price evidence when a sparse summary omits the ask", async () => {
    const old = await store.upsertListing(
      car("sparse", {
        askingPrice: 59900,
        parserVersion: "fixture-detail-v1",
        description: "Detailed engine disclosure",
      }),
    );
    const summary = await store.upsertListing(
      car("sparse", {
        askingPrice: null,
        lastObservedAt: new Date(Date.now() + 5000).toISOString(),
        parserVersion: "fixture-v1",
        description: "Catalog summary",
      }),
    );
    expect(summary.askingPrice).toBe(59900);
    expect(summary.description).toBe(old.description);
    expect(summary.fieldEvidence.askingPrice.observedAt).toBe(now);
  });
  it("keeps user-reviewed identity and location across source refreshes", async () => {
    await store.upsertListing(car("reviewed"));
    const r = await api.inject({
      method: "PATCH",
      url: "/api/listings/reviewed/review",
      headers: auth(),
      payload: {
        year: 1968,
        specialtyEvidence: "user-reviewed",
        vehicleLocation: {
          city: "Madison",
          state: "WI",
          country: "US",
          precision: "city",
        },
        reason: "Reviewed actual vehicle paperwork",
      },
    });
    expect(r.statusCode).toBe(200);
    const refreshed = await store.upsertListing(
      car("reviewed", {
        year: 1969,
        parserVersion: "fixture-detail-v1",
        lastObservedAt: new Date(Date.now() + 6000).toISOString(),
      }),
    );
    expect(refreshed.year).toBe(1968);
    expect(refreshed.vehicleLocation?.city).toBe("Madison");
    expect(refreshed.specialtyEvidence).toBe("user-reviewed");
    expect(JSON.stringify(await store.snapshot(true))).not.toContain(
      "Reviewed actual vehicle paperwork",
    );
  });
  it("uses the same stale inventory projection for snapshot and API search", async () => {
    await store.upsertListing(
      car("aged", { lastObservedAt: "2020-01-01T00:00:00Z" }),
    );
    expect(
      (await store.allListings()).find((l) => l.id === "aged")?.availability,
    ).toBe("stale");
    const response = await api.inject({
      method: "POST",
      url: "/api/search",
      headers: auth(),
      payload: { ...defaultSearch(), mode: "nationwide" },
    });
    expect(
      response.json().rows.some((l: { id: string }) => l.id === "aged"),
    ).toBe(false);
  });
  it("advances capped route enrichment beyond already fresh routes", async () => {
    const { routeListings } = await import("../server/geography");
    for (const id of ["route-a", "route-b"])
      await store.upsertListing(
        car(id, {
          vehicleLocation: {
            city: "Madison",
            state: "WI",
            precision: "city",
            lat: 43.07,
            lon: -89.38,
          },
        }),
      );
    const calls: string[] = [];
    const provider = {
      name: "fixture-routing",
      async route() {
        calls.push("called");
        return {
          minutes: 120,
          miles: 100,
          provider: "fixture-routing",
          observedAt: new Date().toISOString(),
          origin: "Wheaton, IL",
          destination: "Madison, WI",
          options: "no ferry",
          traffic: false,
          precision: "city",
        };
      },
    };
    await routeListings(1, provider);
    await routeListings(1, provider);
    expect(calls).toHaveLength(2);
    const routed = (await store.allListings()).filter(
      (l) => l.route?.provider === "fixture-routing",
    );
    expect(routed).toHaveLength(2);
  });
  it("requires bid opt-in and emits a stable deadline alert only once", async () => {
    const { evaluateAlerts } = await import("../server/alerts");
    await db.savedSearch.updateMany({ data: { schedule: "off" } });
    const deadline = new Date(Date.now() + 3600000).toISOString();
    await store.upsertListing(
      car("auction", {
        saleType: "auction",
        availability: "live-auction",
        currentBid: 10000,
        askingPrice: null,
        auctionEnd: deadline,
      }),
    );
    await db.savedSearch.create({
      data: {
        id: "auction-search",
        name: "Auction",
        filters: JSON.stringify({
          ...defaultSearch(),
          mode: "nationwide",
          saleTypes: ["auction"],
          availability: ["live-auction"],
        }),
        defaultsVersion: 1,
        schedule: "hourly",
        deadlineAlerts: true,
      },
    });
    expect(await evaluateAlerts(true)).toEqual({ created: 0 });
    await store.upsertListing(
      car("auction", {
        saleType: "auction",
        availability: "live-auction",
        currentBid: 12000,
        askingPrice: null,
        auctionEnd: deadline,
        lastObservedAt: new Date(Date.now() + 7000).toISOString(),
      }),
    );
    expect(await evaluateAlerts(true)).toEqual({ created: 1 });
    expect(
      await db.alert.count({
        where: { searchId: "auction-search", kind: "bid-change" },
      }),
    ).toBe(0);
    await db.savedSearch.update({
      where: { id: "auction-search" },
      data: { bidAlerts: true },
    });
    await store.upsertListing(
      car("auction", {
        saleType: "auction",
        availability: "live-auction",
        currentBid: 14000,
        askingPrice: null,
        auctionEnd: deadline,
        lastObservedAt: new Date(Date.now() + 8000).toISOString(),
      }),
    );
    expect(await evaluateAlerts(true)).toEqual({ created: 1 });
    expect(
      await db.alert.count({
        where: { searchId: "auction-search", kind: "auction-deadline" },
      }),
    ).toBe(1);
  });
});
