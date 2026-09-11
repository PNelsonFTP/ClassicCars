import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  it,
  vi,
} from "vitest";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import {
  parseDetail,
  parseInventory,
  type SourceConfig,
} from "../server/ingest/adapters";
import { projectFreshness } from "../shared/freshness";
import type { Listing } from "../shared/schema";

const temporary = mkdtempSync(
  join(tmpdir(), "musclescout-availability-regression-"),
);
process.env.DATABASE_URL = `file:${temporary}/test.db`;
let db: (typeof import("../server/db"))["db"],
  store: typeof import("../server/store");
const sources: SourceConfig[] = JSON.parse(
  readFileSync("config/sources.json", "utf8"),
);
const priorAt = "2026-09-08T02:30:00Z",
  observedAt = "2026-09-10T20:00:00Z";
const context = (url: string, stamp = priorAt) => ({
  url,
  observedAt: stamp,
  lastNetworkCheckedAt: stamp,
  hash: "offline-availability-fixture",
  scope: "regional" as const,
});
function catalog(sourceId: string, filename: string) {
  const source = sources.find((source) => source.id === sourceId)!;
  return parseInventory(
    readFileSync(`tests/fixtures/${filename}.html`, "utf8"),
    source,
    context(source.inventory![0]),
  ).listings[0];
}
// Exercise the real Shopify parser with a matching offer attached to the existing captured catalog ad.
function productDetail(listing: Listing, availability: string) {
  return `<script type="application/ld+json">${JSON.stringify({ "@type": "Product", url: listing.url, offers: { price: "38500.00", availability: `https://schema.org/${availability}` } })}</script>`;
}
beforeAll(async () => {
  const Database = createRequire(import.meta.url)("better-sqlite3"),
    sqlite = new Database(`${temporary}/test.db`);
  for (const dir of readdirSync("prisma/migrations").sort()) {
    const sql = join("prisma/migrations", dir, "migration.sql");
    if (existsSync(sql)) sqlite.exec(readFileSync(sql, "utf8"));
  }
  sqlite.close();
  ({ db } = await import("../server/db"));
  store = await import("../server/store");
});
beforeEach(async () => {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse(observedAt));
  await db.observation.deleteMany();
  await db.listing.deleteMany();
  await db.setting.deleteMany();
  await db.groupReview.deleteMany();
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await db?.$disconnect();
  rmSync(temporary, { recursive: true, force: true });
});

it.each([
  ["active", "SoldOut", "sold"],
  ["sold", "InStock", "active"],
  ["active", "PreOrder", "unknown"],
] as const)(
  "persists Shopify source availability %s → %s through parser, store and read projection",
  async (oldStatus, offerStatus, expected) => {
    const original = {
      ...catalog("jsmotors", "jsmotors-card-1982"),
      availability: oldStatus,
    };
    await store.upsertListing(original);
    const previous = (await store.allListings())[0];
    expect(previous.sourceAvailability).toBe(oldStatus);
    const detail = parseDetail(
      productDetail(previous, offerStatus),
      previous,
      context(previous.url, observedAt),
    );
    expect(detail.availability).toBe(expected);
    await store.upsertListing(detail);
    const persisted = JSON.parse(
      (await db.listing.findUniqueOrThrow({ where: { id: previous.id } }))
        .payload,
    );
    expect(persisted.sourceAvailability).toBe(expected);
    expect((await store.allListings())[0].availability).toBe(expected);
    expect(
      projectFreshness(persisted, 14, Date.parse(observedAt)).availability,
    ).toBe(expected);
    const observation = await db.observation.findFirstOrThrow({
      where: {
        listingId: previous.id,
        kind: "availability",
        observedAt: new Date(observedAt),
      },
    });
    expect(JSON.parse(observation.payload).availability).toBe(expected);
    expect(previous.sourceAvailability).toBe(oldStatus);
  },
);

it("preserves actual source status rather than persisting a stale projection when a detail has no availability evidence", async () => {
  const original = catalog("midwest", "midwest-card-3037");
  await store.upsertListing(original);
  const previous = projectFreshness(
    (await store.allListings())[0],
    1,
    Date.parse(observedAt),
  );
  expect(previous.availability).toBe("stale");
  expect(previous.sourceAvailability).toBe("active");
  const detail = parseDetail(
    readFileSync("tests/fixtures/midwest-detail-3037.html", "utf8"),
    previous,
    context(previous.url, observedAt),
  );
  expect(detail.availability).toBe("active");
  expect(detail.sourceAvailability).toBe("active");
  await store.upsertListing(detail);
  expect((await store.allListings())[0]).toMatchObject({
    availability: "active",
    sourceAvailability: "active",
  });
});

it("promotes a stored unknown ClassicCars ad when its captured detail explicitly says For Sale", async () => {
  const original = catalog("classiccars", "classiccars-catalog");
  original.id = "classiccars:CC-2104715";
  original.sourceListingId = "CC-2104715";
  await store.upsertListing(original);
  const previous = (await store.allListings())[0];
  expect(previous.sourceAvailability).toBe("unknown");
  const detail = parseDetail(
    readFileSync("tests/fixtures/classiccars-2104715-detail.html", "utf8"),
    previous,
    context(previous.url, observedAt),
  );
  expect(detail.availability).toBe("active");
  await store.upsertListing(detail);
  expect((await store.allListings())[0]).toMatchObject({
    availability: "active",
    sourceAvailability: "active",
  });
});
