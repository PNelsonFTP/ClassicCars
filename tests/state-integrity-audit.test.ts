import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  existsSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { listingSchema } from "../shared/schema";
import { unpackCatalog } from "../shared/catalog";
import {
  parseAuthorizedFeed,
  feedAllowsPublicExport,
  feedAllowsPublicImages,
} from "../server/ingest/authorized-feed";
const folder = mkdtempSync(join(tmpdir(), "musclescout-state-audit-"));
process.env.DATABASE_URL = `file:${folder}/test.db`;
let store: typeof import("../server/store"),
  grouping: typeof import("../server/grouping"),
  db: (typeof import("../server/db"))["db"];
const stamp = "2026-09-08T00:00:00Z",
  later = "2026-09-09T00:00:00Z";
const location = {
  city: "Wheaton",
  state: "IL",
  country: "US",
  precision: "city",
  offsite: false,
};
const geocoded = {
  ...location,
  lat: 41.8647,
  lon: -88.1102,
  provider: "fixture-geocoder",
  observedAt: stamp,
};
const route = {
  minutes: 60,
  miles: 50,
  provider: "fixture-routing",
  observedAt: stamp,
  origin: "Home",
  destination: "Wheaton, IL",
  options: "none",
  precision: "city",
};
const car = (id: string, extra: Record<string, unknown> = {}) =>
  listingSchema.parse({
    id,
    sourceListingId: id,
    sourceId: "fixture",
    sourceName: "Fixture Gallery",
    url: "https://example.com/" + id,
    title: "1969 Chevrolet Camaro",
    year: 1969,
    model: "Camaro",
    seller: { name: "Fixture Gallery", type: "dealer" },
    firstSeenAt: stamp,
    lastObservedAt: stamp,
    availability: "active",
    askingPrice: 30000,
    saleType: "fixed",
    vehicleLocation: location,
    ...extra,
  });
beforeAll(async () => {
  const Database = createRequire(import.meta.url)("better-sqlite3"),
    sqlite = new Database(`${folder}/test.db`);
  for (const dir of readdirSync("prisma/migrations").sort()) {
    const sql = join("prisma/migrations", dir, "migration.sql");
    if (existsSync(sql)) sqlite.exec(readFileSync(sql, "utf8"));
  }
  sqlite.close();
  ({ db } = await import("../server/db"));
  store = await import("../server/store");
  grouping = await import("../server/grouping");
});
beforeEach(async () => {
  await db.listing.deleteMany();
  await db.observation.deleteMany();
  await db.setting.deleteMany();
  await db.groupReview.deleteMany();
});
afterAll(async () => {
  await db?.$disconnect();
  rmSync(folder, { recursive: true, force: true });
});
describe("integrated state integrity audit", () => {
  it("preserves geocoded location and route when a detail refresh repeats the same source address", () => {
    const raw = car("same", { parserVersion: "fixture-detail-v1" });
    const old = store.mergeObservation(undefined, raw);
    old.vehicleLocation = listingSchema.parse({
      ...old,
      vehicleLocation: geocoded,
    }).vehicleLocation;
    old.route = listingSchema.parse({ ...old, route }).route;
    const merged = store.mergeObservation(
      old,
      car("same", {
        parserVersion: "fixture-detail-v1",
        lastObservedAt: later,
      }),
    );
    expect(merged.vehicleLocation?.lat).toBe(geocoded.lat);
    expect(merged.route?.minutes).toBe(60);
    expect(merged.sourceRecord?.vehicleLocation?.lat).toBeUndefined();
  });
  it("invalidates a route when a catalog refresh establishes a different actual city", () => {
    const old = car("moved", { vehicleLocation: geocoded, route });
    const merged = store.mergeObservation(
      old,
      car("moved", {
        vehicleLocation: { ...location, city: "Madison", state: "WI" },
        lastObservedAt: later,
        parserVersion: "catalog-v1",
      }),
    );
    expect(merged.vehicleLocation?.city).toBe("Madison");
    expect(merged.route).toBeNull();
    expect(merged.straightLineMiles).toBeNull();
  });
  it("keeps a reviewed actual location and its route when raw seller location changes", () => {
    const old = store.mergeObservation(
      undefined,
      car("reviewed", {
        vehicleLocation: geocoded,
        route,
        userOverrides: {
          vehicleLocation: geocoded,
          reviewedAt: stamp,
          reason: "Actual location reviewed privately",
        },
      }),
    );
    const merged = store.mergeObservation(
      old,
      car("reviewed", {
        vehicleLocation: { ...location, city: "Madison", state: "WI" },
        parserVersion: "fixture-detail-v1",
        lastObservedAt: later,
      }),
    );
    expect(merged.vehicleLocation?.city).toBe("Wheaton");
    expect(merged.route?.minutes).toBe(60);
    expect(merged.sourceRecord?.vehicleLocation?.city).toBe("Madison");
  });
  it("retains automatic groups formed after the first review baseline when undoing an unrelated review", async () => {
    for (const id of ["x", "y", "a", "b"]) await store.upsertListing(car(id));
    const review = await grouping.mergeReviewedGroups({
      ids: ["x", "y"],
      reason: "Synthetic manual review",
    });
    for (const id of ["a", "b"])
      await store.upsertListing(
        car(id, {
          model: "Mustang",
          year: 1993,
          identifier: "1FACP42E1PF100001",
          lastObservedAt: later,
        }),
      );
    const group = (await db.listing.findUnique({ where: { id: "a" } }))!
      .groupId;
    expect(group).toMatch(/^vehicle:/);
    await grouping.unmergeReviewedGroup(review.reviewId);
    expect((await db.listing.findUnique({ where: { id: "a" } }))!.groupId).toBe(
      group,
    );
    expect((await db.listing.findUnique({ where: { id: "b" } }))!.groupId).toBe(
      group,
    );
  });
  it("does not resurrect a conflicting detached automatic-group member during unrelated replay", async () => {
    for (const id of ["a", "b"])
      await store.upsertListing(
        car(id, {
          model: "Mustang",
          year: 1993,
          identifier: "1FACP42E1PF100001",
        }),
      );
    for (const id of ["x", "y"]) await store.upsertListing(car(id));
    const review = await grouping.mergeReviewedGroups({
      ids: ["x", "y"],
      reason: "Synthetic manual review",
    });
    await store.upsertListing(
      car("a", {
        model: "Mustang",
        year: 1993,
        identifier: "1FACP42E1PF100002",
        lastObservedAt: later,
      }),
    );
    expect(
      (await db.listing.findUnique({ where: { id: "a" } }))!.groupId,
    ).toBeNull();
    await grouping.unmergeReviewedGroup(review.reviewId);
    expect(
      (await db.listing.findUnique({ where: { id: "a" } }))!.groupId,
    ).toBeNull();
  });
  it("redacts identifiers, contacts and private review notes in evidence fields", async () => {
    await store.upsertListing(
      car("secret", {
        identifier: "PRIVATE_IDENTIFIER_FIXTURE",
        fieldEvidence: {
          identifier: { value: "PRIVATE_IDENTIFIER_FIXTURE", basis: "parsed" },
          paint: {
            value: "red",
            basis: "user-reviewed",
            note: "PRIVATE_REVIEW_FIXTURE",
          },
          sellerContact: {
            value: "secret@example.com",
            basis: "seller-claimed",
          },
        },
        specs: {
          paint: {
            value: "red",
            basis: "user-reviewed",
            note: "PRIVATE_SPEC_REVIEW_FIXTURE",
          },
        },
      }),
    );
    const exported = JSON.stringify(await store.snapshot(true));
    for (const privateValue of [
      "PRIVATE_IDENTIFIER_FIXTURE",
      "PRIVATE_REVIEW_FIXTURE",
      "PRIVATE_SPEC_REVIEW_FIXTURE",
      "secret@example.com",
    ])
      expect(exported).not.toContain(privateValue);
  });
  it("preserves each correction's own reason/date through another field review and later source refresh", async () => {
    const reviews = await import("../server/reviews");
    await store.upsertListing(car("per-field"));
    const yearReview = await reviews.correctListing("per-field", {
      year: 1975,
      reason: "Private year documentation reviewed",
    });
    await reviews.correctListing("per-field", {
      vehicleLocation: { ...location, city: "Madison", state: "WI" },
      reason: "Different private location document reviewed",
    });
    const refreshed = await store.upsertListing(
      car("per-field", { year: 1968, lastObservedAt: later }),
    );
    expect(refreshed.year).toBe(1975);
    expect(refreshed.sourceRecord?.year).toBe(1968);
    expect(refreshed.fieldEvidence.year).toEqual(yearReview.fieldEvidence.year);
    const reset = await reviews.resetCorrection(
      "per-field",
      "Return to the latest source record",
    );
    expect(reset.year).toBe(1968);
    expect(reset.generation).toBe("First generation");
  });
  it("does not invent a source baseline from a legacy reviewed row during derived geography updates", () => {
    const legacy = car("legacy", {
      year: 1975,
      userOverrides: {
        year: 1975,
        reviewedAt: stamp,
        reason: "Legacy private correction with no original source baseline",
      },
    });
    const imported = store.mergeObservation(undefined, legacy);
    expect(imported.sourceRecord).toBeUndefined();
    const geocodedLegacy = store.mergeObservation(legacy, {
      ...legacy,
      vehicleLocation: listingSchema.parse({
        ...legacy,
        vehicleLocation: geocoded,
      }).vehicleLocation,
    });
    expect(geocodedLegacy.sourceRecord).toBeUndefined();
    const freshSource = store.mergeObservation(
      geocodedLegacy,
      car("legacy", { year: 1968, lastObservedAt: later }),
    );
    expect(freshSource.year).toBe(1975);
    expect(freshSource.sourceRecord?.year).toBe(1968);
  });
  it("does not restore an obsolete automatic subgroup hidden under an active manual review", async () => {
    for (const id of ["a", "b"])
      await store.upsertListing(
        car(id, {
          model: "Mustang",
          year: 1993,
          identifier: "1FACP42E1PF100001",
        }),
      );
    await store.upsertListing(car("x"));
    const review = await grouping.mergeReviewedGroups({
      ids: ["a", "x"],
      reason: "Synthetic reviewed relationship",
    });
    await store.upsertListing(
      car("a", {
        model: "Mustang",
        year: 1993,
        identifier: "1FACP42E1PF100002",
        lastObservedAt: later,
      }),
    );
    await grouping.unmergeReviewedGroup(review.reviewId);
    expect(
      (await db.listing.findUnique({ where: { id: "a" } }))!.groupId,
    ).toBeNull();
    expect(
      (await db.listing.findUnique({ where: { id: "b" } }))!.groupId,
    ).toBeNull();
  });
  it("stops publicly exporting an authorized feed when its permission expires", () => {
    const expiredAt = "2026-09-10T00:00:00Z";
    const result = parseAuthorizedFeed(
      {
        manifest: {
          schemaVersion: 1,
          feedId: "fixture-feed",
          sourceId: "fixture",
          sourceName: "Fixture",
          generatedAt: stamp,
          scope: "regional",
          query: "Camaro",
          authorization: {
            basis: "dealer-permission",
            reference: "Synthetic permission",
            reviewedAt: stamp,
            expiresAt: expiredAt,
            publicRedistribution: true,
            imageRedistribution: true,
          },
          allowedListingHosts: ["example.com"],
          allowedImageHosts: ["example.com"],
          pagination: { cursor: null, nextCursor: null, terminal: true },
        },
        listings: [
          {
            sourceListingId: "a",
            url: "https://example.com/a",
            title: "1969 Chevrolet Camaro",
            wholeVehicle: true,
            observedAt: stamp,
            seller: { name: "Fixture dealer" },
            photos: ["https://example.com/a.jpg"],
          },
        ],
      },
      new Date(stamp),
    );
    const l = result.listings[0];
    expect(l.fieldEvidence["feed.authorizationExpiresAt"]?.value).toBe(
      expiredAt,
    );
    expect(feedAllowsPublicExport(l, Date.parse(expiredAt) - 1)).toBe(true);
    expect(feedAllowsPublicExport(l, Date.parse(expiredAt))).toBe(false);
    expect(feedAllowsPublicImages(l, Date.parse(expiredAt))).toBe(false);
  });
  it("removes superseded owned detail chunks after a new public export", async () => {
    const output = join(folder, "export"),
      old = join(output, "details/aaaaaaaaaaaaaaaaaaaaaaaa.json");
    mkdirSync(join(output, "details"), { recursive: true });
    writeFileSync(old, '[{"private":"formerly public licensed row"}]');
    await store.upsertListing(car("public"));
    await store.exportSnapshot(output);
    expect(existsSync(old)).toBe(false);
    const catalog = unpackCatalog(
      JSON.parse(readFileSync(join(output, "catalog.json"), "utf8")),
    );
    expect(existsSync(join(output, catalog.detailFiles!.public))).toBe(true);
  });
});
