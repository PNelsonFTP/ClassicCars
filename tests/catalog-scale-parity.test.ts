import { describe, expect, it } from "vitest";
import { catalogListing, packCatalog, unpackCatalog } from "../shared/catalog";
import { fieldValue, matches, searchListings } from "../shared/search";
import { projectFreshness } from "../shared/freshness";
import { evaluateAlertPolicy } from "../shared/alert-policy";
import { searchPageFromBatches } from "../server/search-page-core";
import {
  BENCHMARK_NOW,
  scaleFixture,
  scaleQueries,
  scaleWorkspace,
} from "./helpers/scale-fixture";
const full = scaleFixture(1200).map((l) =>
    projectFreshness(l, 14, BENCHMARK_NOW, 6),
  ),
  compact = full.map(catalogListing),
  workspace = scaleWorkspace(full),
  payloads = full.map((l) => ({ payload: JSON.stringify(l) }));
async function* batches() {
  for (let i = 0; i < payloads.length; i += 97) yield payloads.slice(i, i + 97);
}
const ids = (rows: { id: string }[]) => rows.map((l) => l.id);
describe("compact catalog and one-clock search parity", () => {
  it.each(scaleQueries())(
    "preserves full/compact/browser/API/alert predicate parity: $name",
    async ({ filters }) => {
      const expected = searchListings(full, filters, workspace, BENCHMARK_NOW),
        browser = searchListings(compact, filters, workspace, BENCHMARK_NOW);
      expect(ids(browser.rows)).toEqual(ids(expected.rows));
      expect(browser.rawCount).toBe(expected.rawCount);
      expect(browser.groupCount).toBe(expected.groupCount);
      const matchingAds = searchListings(
        full,
        { ...filters, grouped: false },
        workspace,
        BENCHMARK_NOW,
      ).rows;
      expect(new Set(ids(matchingAds))).toEqual(
        new Set(
          ids(
            full.filter((l) => matches(l, filters, workspace, BENCHMARK_NOW)),
          ),
        ),
      );
      const alerts = evaluateAlertPolicy({
        allListings: full,
        matchingAds,
        previous: null,
        now: new Date(BENCHMARK_NOW),
      });
      expect(alerts.changes).toEqual([]);
      expect(Object.keys(alerts.baseline.ads).sort()).toEqual(
        ids(matchingAds).sort(),
      );
      for (const offset of [
        ...new Set([
          0,
          Math.floor(expected.rows.length / 2),
          Math.max(0, expected.rows.length - 37),
        ]),
      ]) {
        const page = await searchPageFromBatches(filters, offset, 37, {
          batches: batches(),
          workspace,
          staleDays: 14,
          auctionMaxAgeHours: 6,
          now: BENCHMARK_NOW,
        });
        expect(ids(page.rows)).toEqual(
          ids(expected.rows.slice(offset, offset + 37)),
        );
        expect(page.total).toBe(expected.rows.length);
        expect(page.rawCount).toBe(expected.rawCount);
        expect(page.groupCount).toBe(expected.groupCount);
      }
    },
  );
  it("all paginated rows are reachable exactly once under tied values and crosspost groups", async () => {
    const filters = scaleQueries().find(
        (q) => q.name === "nationwide-grouped",
      )!.filters,
      expected = searchListings(full, filters, workspace, BENCHMARK_NOW).rows;
    const actual: string[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
      const page = await searchPageFromBatches(filters, offset, 73, {
        batches: batches(),
        workspace,
        staleDays: 14,
        auctionMaxAgeHours: 6,
        now: BENCHMARK_NOW,
      });
      actual.push(...ids(page.rows));
      offset = page.nextOffset;
    }
    expect(actual).toEqual(ids(expected));
    expect(new Set(actual).size).toBe(actual.length);
  });
  it("retains every addressable scalar rule value, gallery array and optional provenance field", () => {
    const l = full[82],
      c = catalogListing(l),
      paths = new Set<string>([
        "photos",
        "photos.length",
        "originalSellerText",
        "evidenceRef",
        "userOverrides.reason",
        "fieldEvidence.askingPrice.sourceUrl",
      ]);
    function walk(value: unknown, path = "") {
      if (path) paths.add(path);
      if (value && typeof value === "object")
        for (const [key, child] of Object.entries(value))
          walk(child, path ? `${path}.${key}` : key);
    }
    walk(l);
    for (const field of paths) {
      const before = fieldValue(l, field),
        after = fieldValue(c, field);
      // Include/exclude stringify objects; known/unknown only inspect absence. Per-spec lookup exposes only .value.
      if (before && typeof before === "object")
        expect(String(after), field).toBe(String(before));
      else expect(after, field).toEqual(before);
    }
    expect(c.specs.engine.note).toBeUndefined();
    expect(c.photos).toHaveLength(4);
  });
  it("uses the supplied fixed clock at exact route and stale boundaries despite ambient time", () => {
    const car = {
      ...full.find(
        (l) => l.model === "Camaro" && l.vehicleLocation && l.route,
      )!,
      availability: "active" as const,
      sourceAvailability: "active" as const,
    };
    car.vehicleLocation = {
      ...car.vehicleLocation!,
      country: "US",
      precision: "city",
      offsite: false,
    };
    car.route = {
      ...car.route!,
      observedAt: new Date(BENCHMARK_NOW - 30 * 864e5).toISOString(),
      minutes: 240,
    };
    car.lastObservedAt = new Date(BENCHMARK_NOW).toISOString();
    car.identityStatus = "consistent";
    const filters = scaleQueries()[0].filters;
    expect(matches(car, filters, workspace, BENCHMARK_NOW)).toBe(true);
    expect(matches(car, filters, workspace, BENCHMARK_NOW + 1)).toBe(false);
    expect(
      searchListings([car], filters, workspace, BENCHMARK_NOW).rows,
    ).toHaveLength(1);
  });
});
describe("lossless dictionary catalog transport", () => {
  it("round trips the compact catalog and preserves predicate results after browser decoding", () => {
    const payload = {
      schemaVersion: 1,
      listings: compact,
      detailFiles: { [compact[0].id]: "data/details/exact-ad.json" },
    };
    const packed = packCatalog(payload),
      decoded = unpackCatalog<typeof payload>(
        JSON.parse(JSON.stringify(packed)),
      );
    expect(decoded).toEqual(JSON.parse(JSON.stringify(payload)));
    expect(JSON.stringify(packed).length).toBeLessThan(
      JSON.stringify(payload).length,
    );
    for (const { filters } of scaleQueries())
      expect(
        ids(
          searchListings(decoded.listings, filters, workspace, BENCHMARK_NOW)
            .rows,
        ),
      ).toEqual(
        ids(searchListings(full, filters, workspace, BENCHMARK_NOW).rows),
      );
  });
  it("cannot confuse user arrays and objects with encoding markers or change prototype keys", () => {
    const value = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":"original","markers":[["r",0],["a",[]],["o",[]]],"repeated":["repeated long literal string","repeated long literal string"]}',
    );
    const decoded = unpackCatalog<Record<string, unknown>>(
      JSON.parse(JSON.stringify(packCatalog(value))),
    );
    expect(decoded).toEqual(value);
    expect(Object.hasOwn(decoded, "__proto__")).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("supports old plain snapshots and rejects malformed dictionary references and tags", () => {
    const plain = { schemaVersion: 1, listings: [] };
    expect(unpackCatalog(plain)).toBe(plain);
    expect(() =>
      unpackCatalog({
        encoding: "musclescout-dictionary-v1",
        strings: [],
        value: ["r", 2],
      }),
    ).toThrow(/reference/);
    expect(() =>
      unpackCatalog({
        encoding: "musclescout-dictionary-v1",
        strings: [],
        value: ["unknown", 2],
      }),
    ).toThrow(/tag/);
    expect(() =>
      unpackCatalog({
        encoding: "musclescout-dictionary-v1",
        strings: [],
        value: [
          "o",
          [
            ["x", 1],
            ["x", 2],
          ],
        ],
      }),
    ).toThrow(/Duplicate/);
  });
});
