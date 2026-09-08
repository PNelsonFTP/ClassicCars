import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  parseInventory,
  parseDetail,
  type SourceConfig,
} from "../server/ingest/adapters";
const sources: SourceConfig[] = JSON.parse(
  readFileSync("config/sources.json", "utf8"),
);
const source = (id: string) => sources.find((s) => s.id === id)!;
const fixture = (name: string) =>
  readFileSync(`tests/fixtures/${name}.html`, "utf8");
const context = (id: string, url?: string) => ({
  url: url || source(id).inventory![0],
  observedAt: "2026-09-08T02:30:00Z",
  lastNetworkCheckedAt: "2026-09-08T02:30:00Z",
  hash: "fixture",
  scope: "regional" as const,
});
const parse = (id: string, name: string) =>
  parseInventory(fixture(name), source(id), context(id));
describe("sanitized live-source fixture contracts", () => {
  it.each([
    ["volo", "volo-card-19325", "volo:19325", 88998],
    ["grauto", "grauto-card-bw4525", "grauto:bw4525", 184900],
    ["admcars", "admcars-card-1129", "admcars:1129", 79900],
    [
      "jsmotors",
      "jsmotors-card-1982",
      "jsmotors:1982-corvette-collector-car",
      38500,
    ],
    ["500classic", "500classic-card-129066294", "500classic:129066294", 18900],
  ])(
    "binds %s card ID, asking price and image correctly",
    (id, name, key, price) => {
      const l = parse(id, name).listings[0];
      expect(l.id).toBe(key);
      expect(l.askingPrice).toBe(price);
      expect(l.photos.length).toBeGreaterThan(0);
      expect(l.lastObservedAt).toBe(context(id).observedAt);
    },
  );
  it("does not infer Shopify sold status from hidden text", () =>
    expect(
      parse("jsmotors", "jsmotors-card-1982").listings[0].availability,
    ).toBe("active"));
  it("does not erase rich card evidence with a duplicate sparse card", () => {
    const full = fixture("volo-card-19325"),
      sparse = full.replace(
        /<h2 class="only-price">[\s\S]*?<\/h2>/,
        '<h2 class="only-price"></h2>',
      );
    const r = parseInventory(full + sparse, source("volo"), context("volo"));
    expect(r.listings).toHaveLength(1);
    expect(r.listings[0].askingPrice).toBe(88998);
  });
  it.each([
    ["3194", 59900],
    ["3110", 79900],
    ["3037", 45000],
  ])("reads all alternating Midwest %s detail cells", (id, ask) => {
    const l = parse("midwest", "midwest-card-" + id).listings[0],
      d = parseDetail(
        fixture("midwest-detail-" + id),
        l,
        context("midwest", l.url),
      );
    expect(d.askingPrice).toBe(ask);
    expect(d.vehicleLocation?.state).toBe("IL");
    expect(d.specs.engineInstalled.value).toBeTruthy();
  });
  it("isolates ADM main vehicle fields from similar inventory", () => {
    const l = parse("admcars", "admcars-card-1129").listings[0],
      d = parseDetail(
        '<div id="details">' + fixture("admcars-detail-1129") + "</div>",
        l,
        context("admcars", l.url),
      );
    expect(d.specs.engineInstalled.value).toBe("302");
    expect(d.specs.transmission.value).toBe("4-Speed Manual");
  });
  it("North Shore recognizes literal data links without executing handlers", () => {
    const r = parse("nsclassics", "nsclassics-card");
    expect(r.listings[0].sourceListingId).toBe("6125");
    expect(r.listings[0].askingPrice).toBe(78875);
  });
  it("requires exact ClassicCars detail identity and preserves off-site uncertainty", () => {
    const rows = parse("classiccars", "classiccars-catalog").listings;
    const base = rows[0];
    const id = "CC-2105001";
    const d = parseDetail(
      fixture("classiccars-2105001-detail"),
      { ...base, id: "classiccars:" + id, sourceListingId: id },
      context("classiccars"),
    );
    expect(d.vehicleLocation).toBeNull();
    expect(d.routeUnknownReason).toContain("off-site");
    expect(() =>
      parseDetail(
        fixture("classiccars-2105001-detail"),
        { ...base, sourceListingId: "CC-999" },
        context("classiccars"),
      ),
    ).toThrow("identity");
  });
  it("keeps auction asks null and OBO asking prices numeric", () => {
    const base = parse("classiccars", "classiccars-catalog").listings[0];
    const auction = parseDetail(
      fixture("classiccars-2103447-detail"),
      { ...base, sourceListingId: "CC-2103447" },
      context("classiccars"),
    );
    expect(auction.saleType).toBe("auction");
    expect(auction.askingPrice).toBeNull();
    const obo = parseDetail(
      fixture("classiccars-2104715-detail"),
      { ...base, sourceListingId: "CC-2104715" },
      context("classiccars"),
    );
    expect(obo.askingPrice).toBe(21500);
  });
  it("Autotrader joins active results rather than sponsored off-filter inventory", () => {
    const r = parse("autotrader", "autotrader-catalog");
    expect(r.listings.length).toBeGreaterThan(0);
    expect(
      r.listings.every(
        (l) =>
          !l.title.includes("[object Object]") &&
          l.year! >= 1960 &&
          l.year! <= 1989,
      ),
    ).toBe(true);
    expect(r.listings[0].photos.length).toBeGreaterThan(0);
    expect(r.listings[0].availability).toBe("unknown");
  });
  it("fails changed layouts rather than claiming zero inventory", () => {
    expect(() =>
      parseInventory(
        "<html>Unexpected template</html>",
        source("volo"),
        context("volo"),
      ),
    ).toThrow("layout");
    expect(() =>
      parseInventory(
        "<html>Unexpected template</html>",
        source("autotrader"),
        context("autotrader"),
      ),
    ).toThrow();
  });
  it("follows only same-origin linked pagination and never challenge POSTs", () => {
    const html =
      fixture("volo-card-19325") +
      '<a rel="next" href="/vehicles?page=2">Next</a><a rel="next" href="https://evil.example/page">Bad</a>';
    expect(parseInventory(html, source("volo"), context("volo")).next).toEqual([
      "https://www.volocars.com/vehicles?page=2",
    ]);
  });
  it("rejects unavailable dealer detail pages instead of claiming enrichment", () => {
    const l = parse("midwest", "midwest-card-3194").listings[0];
    expect(() =>
      parseDetail(
        "<html><title>Vehicle unavailable</title></html>",
        l,
        context("midwest"),
      ),
    ).toThrow(/unavailable/);
  });
  it("parses North Shore public detail HTML and keeps average price separate", () => {
    const l = parse("nsclassics", "nsclassics-card").listings[0];
    const detail = parseDetail(
      fixture("nsclassics-detail-6125"),
      l,
      context("nsclassics"),
    );
    expect(detail.askingPrice).toBe(78875);
    expect(detail.specs.engineInstalled.value).toBe("327");
    expect(detail.specs.transmission.value).toBe("Manual 4 Speed");
    expect(detail.vehicleLocation).toBeNull();
    expect(() =>
      parseDetail("<div id='detailed_page'></div>", l, context("nsclassics")),
    ).toThrow();
  });
});
