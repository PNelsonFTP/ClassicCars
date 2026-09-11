import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseDetail } from "../server/ingest/adapters";
import { listingSchema } from "../shared/schema";
const observedAt = "2026-09-10T20:34:20.036Z";
const url =
  "https://www.grautogallery.com/vehicles/b6309-b/1969-chevrolet-corvette-stingray";
const listing = () =>
  listingSchema.parse({
    id: "grauto:b6309-b",
    sourceId: "grauto",
    sourceName: "GR Auto Gallery",
    sourceListingId: "b6309-b",
    title: "1969 Chevrolet Corvette Stingray",
    model: "Corvette",
    year: 1969,
    url,
    seller: { name: "GR Auto Gallery", type: "dealer" },
    vehicleLocation: null,
    askingPrice: 30000,
    firstSeenAt: "2026-09-08T02:30:00Z",
    lastObservedAt: "2026-09-08T02:30:00Z",
  });
const context = {
  url,
  observedAt,
  lastNetworkCheckedAt: observedAt,
  hash: "fixture",
  scope: "regional" as const,
};
const fixture = () =>
  readFileSync("tests/fixtures/grauto-detail-b6309-b.html", "utf8");
it("extracts wrapped GR Auto own-ad specs and ask, excluding financing and other-page fields", () => {
  const html =
    fixture() +
    '<aside><dl><dt>Engine Size</dt><dd>Unrelated engine</dd></dl><div class="vehicle-price"><h2>$99,999</h2></div></aside>';
  const detail = parseDetail(html, listing(), context);
  expect(detail.askingPrice).toBe(28900);
  expect(detail.stockNumber).toBe("B6309 B");
  expect(detail.specs.engineInstalled).toMatchObject({
    value: "350ci V8",
    observedAt,
  });
  expect(detail.specs.transmission.value).toBe("4-Speed Manual");
  expect(detail.specs.odometer.value).toBe("91,576");
  expect(detail.specs.mileageStatus.basis).toBe("unknown");
  expect(detail.specs.exteriorColor.value).toBe("Blue");
  expect(detail.vehicleLocation).toBeNull();
  expect(detail.lastDetailObservedAt).toBe(observedAt);
});
it("requires the exact requested vehicle URL for a space/hyphen stock variation", () => {
  for (const html of [
    fixture().replace('name="redirect_to"', 'name="unrelated"'),
    fixture().replace("/vehicles/b6309-b/", "/vehicles/b6309/"),
    fixture().replace("B6309 B", "B6309 C"),
  ])
    expect(() => parseDetail(html, listing(), context)).toThrow(
      /identity mismatch/,
    );
  expect(() =>
    parseDetail("<h1>Vehicle unavailable</h1>", listing(), context),
  ).toThrow(/layout unavailable/);
});
it("retains support for direct GR Auto dt/dd pairs and exact stock identity", () => {
  const html =
    '<div class="ag-specs-summary-container"><dl class="show-car-details"><dt>Stock</dt><dd>B6309-B</dd><dt>Engine Size</dt><dd>350ci V8</dd><dt>Transmission Type</dt><dd>4-Speed Manual</dd><dt>Price</dt><dd>$28,900</dd></dl></div>';
  const detail = parseDetail(html, listing(), context);
  expect(detail.stockNumber).toBe("B6309-B");
  expect(detail.askingPrice).toBe(28900);
  expect(detail.specs.engineInstalled.value).toBe("350ci V8");
});
