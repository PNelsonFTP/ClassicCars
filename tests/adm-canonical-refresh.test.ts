import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseDetail,
  parseInventory,
  type SourceConfig,
} from "../server/ingest/adapters";

const source = (
  JSON.parse(readFileSync("config/sources.json", "utf8")) as SourceConfig[]
).find((source) => source.id === "admcars")!;
const observedAt = "2026-09-10T20:22:18.868Z";
const context = (url: string) => ({
  url,
  observedAt,
  lastNetworkCheckedAt: observedAt,
  hash: "offline-cached-1516",
  scope: "regional" as const,
});
const listing = parseInventory(
  readFileSync("tests/fixtures/admcars-card-1516.html", "utf8"),
  source,
  context(source.inventory![0]),
).listings[0];
const html = readFileSync(
  "tests/fixtures/admcars-detail-1516-canonical.html",
  "utf8",
);
const cleanUrl =
  "https://www.admcars.com/1967-chevrolet-camaro-ss-options-327-auto-ps-pb-c-1516.htm";
const canonical = (value: string) =>
  html.replace(/(<link\b[^>]*\bhref=")[^"]+/, `$1${value}`);

describe("ADM cached detail canonical identity", () => {
  it("accepts the captured matching ad when only the known sold=Available catalog filter is omitted", () => {
    expect(listing.sourceListingId).toBe("1516");
    expect(listing.url).toBe(`${cleanUrl}?sold=Available&`);
    const detail = parseDetail(html, listing, context(listing.url));
    expect(detail.sourceListingId).toBe("1516");
    expect(detail.specs.engineInstalled.value).toBe("327");
    expect(detail.lastDetailObservedAt).toBe(observedAt);
    expect(detail.url).toBe(listing.url);
  });
  it("retains an ordinary exact canonical match without a filter", () => {
    expect(
      parseDetail(html, { ...listing, url: cleanUrl }, context(cleanUrl))
        .sourceListingId,
    ).toBe("1516");
  });
  it.each([
    ["origin", cleanUrl.replace("www.admcars.com", "other.example")],
    ["ad ID", cleanUrl.replace("1516.htm", "1517.htm")],
    [
      "path",
      cleanUrl.replace("1967-chevrolet-camaro", "1968-chevrolet-camaro"),
    ],
    ["unexpected query", `${cleanUrl}?car=1517`],
    ["scheme", cleanUrl.replace("https:", "http:")],
    ["credentials", cleanUrl.replace("https://", "https://user:pass@")],
  ])("rejects a canonical with a different %s", (_label, changed) => {
    expect(() =>
      parseDetail(canonical(changed), listing, context(listing.url)),
    ).toThrow("canonical identity");
  });
  it.each([
    "sold=Sold",
    "sold=Available&car=1517",
    "sold=Available&sold=Sold",
    "sold=Available&sold=Available",
    "status=Available",
  ])(
    "does not ignore unsupported or ambiguous request parameters: %s",
    (query) => {
      const url = `${cleanUrl}?${query}`;
      expect(() =>
        parseDetail(html, { ...listing, url }, context(url)),
      ).toThrow("canonical identity");
    },
  );
  it("does not apply the filter exception to a different source or mismatched durable ad ID", () => {
    expect(() =>
      parseDetail(
        html,
        { ...listing, sourceId: "fixture" },
        context(listing.url),
      ),
    ).toThrow("canonical identity");
    expect(() =>
      parseDetail(
        html,
        { ...listing, sourceListingId: "1517" },
        context(listing.url),
      ),
    ).toThrow("canonical identity");
  });
});
