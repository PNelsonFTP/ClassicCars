import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseDetail } from "../server/ingest/adapters";
import { listingSchema } from "../shared/schema";

const observedAt = "2026-09-10T20:19:32.818Z";
const listing = () =>
  listingSchema.parse({
    id: "nsclassics:6144",
    sourceId: "nsclassics",
    sourceName: "North Shore Classics",
    sourceListingId: "6144",
    title: "1976 CHEVROLET Corvette NEWER PAINT -T/TOPS-SEE VIDEO",
    model: "Corvette",
    year: 1976,
    url: "https://www.nsclassics.com/used-vehicle-1976-chevrolet-corvette-newer-paint-t-tops-see-video-c-6144/",
    seller: { name: "North Shore Classics", type: "dealer" },
    vehicleLocation: null,
    firstSeenAt: "2026-09-08T02:30:00Z",
    lastObservedAt: "2026-09-08T02:30:00Z",
  });
const context = {
  url: "https://www.nsclassics.com/isapi_xml.php?module=detailed&action=getPage&vid=6144",
  observedAt,
  lastNetworkCheckedAt: observedAt,
  hash: "fixture",
  scope: "regional" as const,
};
const fixture = () =>
  readFileSync(
    "tests/fixtures/nsclassics-detail-6144-empty-description.html",
    "utf8",
  );

it("accepts observed North Shore 6144's own price and specifications despite an empty narrative", () => {
  const detail = parseDetail(fixture(), listing(), context);
  expect(detail.askingPrice).toBe(21525);
  expect(detail.specs.engineInstalled).toMatchObject({
    value: "350",
    observedAt,
  });
  expect(detail.specs.transmission.value).toBe("Automatic");
  expect(detail.specs.exteriorColor.value).toBe("Burgundy/Maroon");
  expect(detail.stockNumber).toBe("76484NSC");
  expect(detail.lastDetailObservedAt).toBe(observedAt);
  expect(detail.vehicleLocation).toBeNull();
});

it("still rejects wrong-ad identity and matching-ID shells without sufficient price/spec evidence", () => {
  expect(() =>
    parseDetail(
      fixture().replace('data-pin="6144"', 'data-pin="9999"'),
      listing(),
      context,
    ),
  ).toThrow(/identity/);
  const identity =
    '<div data-pin="6144"></div><div id="pane-A"><div class="card-body"></div></div>';
  const price =
    '<div class="invent-detail-price"><h3>Our Price: $21,525</h3></div>';
  const field =
    '<div class="car-details"><li><div class="divfirst">Engine</div><div>350</div></li></div>';
  for (const shell of [
    identity,
    identity + price,
    identity + price + field,
    fixture().replace("Our Price: $21,525", "Average Price: $21,525"),
  ])
    expect(() => parseDetail(shell, listing(), context)).toThrow(
      /unrendered shell/,
    );
});
