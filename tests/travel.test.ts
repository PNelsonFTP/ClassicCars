import { redactPublicListing } from "../server/public-redaction";
import { describe, it, expect } from "vitest";
import { defaultSearch, listingSchema, emptyWorkspace } from "../shared/schema";
import {
  createPlaceIndex,
  resolvePlace,
  resolveListingTravel,
  projectTravel,
  travelResult,
  travelEligible,
  routeEvidenceKnown,
  tripDestination,
} from "../shared/travel";
import {
  placeKey,
  ROAD_PROFILE,
  travelAtlasSchema,
  type Place,
  type TravelAtlas,
} from "../shared/travel-contract";
import { matches, searchListings, quickSearch } from "../shared/search";
import { searchPageFromBatches } from "../server/search-page-core";
import { projectSnapshot } from "../shared/freshness";
import { packCatalog, unpackCatalog } from "../shared/catalog";
const now = Date.parse("2026-10-21T18:00:00Z"),
  date = new Date(now).toISOString();
const origin: Place = {
  id: "wheaton",
  city: "Wheaton",
  state: "IL",
  country: "US",
  lat: 41.85,
  lon: -88.1,
  kind: "place",
  aliases: [],
};
const destination: Place = {
  id: "test-city",
  city: "Traverse City",
  state: "MI",
  country: "US",
  lat: 44.76,
  lon: -85.62,
  kind: "place",
  aliases: ["Traverse City city"],
};
function atlas(minutes = 230): TravelAtlas {
  return travelAtlasSchema.parse({
    version: 1,
    generatedAt: date,
    origins: [origin],
    places: [destination],
    graph: {
      version: "roads-test-v1",
      sourceUrl: "https://download.geofabrik.de/north-america/us-midwest.html",
      observedAt: date,
      profile: ROAD_PROFILE,
      region: "US Midwest",
      attribution: "OpenStreetMap contributors",
      licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
    },
    estimates: [
      {
        originKey: placeKey(origin),
        destinationId: destination.id,
        originPoint: [origin.lon, origin.lat],
        destinationPoint: [destination.lon, destination.lat],
        graphObservedAt: date,
        minutes,
        miles: 270,
        computedAt: date,
        provider: "test-road-router",
        graphVersion: "roads-test-v1",
        profile: ROAD_PROFILE,
        originSnapMeters: 50,
        destinationSnapMeters: 100,
      },
    ],
    unresolved: {},
  });
}
function car() {
  return listingSchema.parse({
    id: "car",
    sourceId: "fixture",
    sourceListingId: "1",
    sourceName: "Fixture",
    url: "https://example.com/car",
    title: "1969 Chevrolet Camaro",
    model: "Camaro",
    year: 1969,
    saleType: "fixed",
    availability: "active",
    askingPrice: 25000,
    seller: {
      name: "Dealer",
      type: "dealer",
      location: {
        city: destination.city,
        state: destination.state,
        country: "US",
        precision: "city",
      },
    },
    firstSeenAt: date,
    lastObservedAt: date,
  });
}
function routed(minutes = 230) {
  const l = car();
  l.travel = resolveListingTravel(l, atlas(minutes));
  return l;
}
describe("city and approximate road travel", () => {
  it("resolves state-qualified names and dataset aliases without stripping City from natural names", () => {
    const index = createPlaceIndex([
      destination,
      { ...destination, id: "other-state", state: "TX" },
    ]);
    expect(
      resolvePlace({ city: "Traverse City", state: "MI" }, index)?.id,
    ).toBe(destination.id);
    expect(resolvePlace({ city: "Traverse", state: "MI" }, index)).toBeNull();
    expect(
      resolvePlace({ city: "Traverse City city", state: "MI" }, index)?.id,
    ).toBe(destination.id);
  });
  it("does not guess ambiguous subdivisions or use arbitrary postal representative points", () => {
    const index = createPlaceIndex([
      { ...destination, kind: "subdivision" },
      { ...destination, id: "second", kind: "subdivision" },
      { ...destination, id: "zip", kind: "postal" },
    ]);
    expect(resolvePlace(destination, index)).toBeNull();
    expect(
      resolvePlace(
        destination,
        createPlaceIndex([{ ...destination, kind: "postal" }]),
      ),
    ).toBeNull();
    expect(
      resolvePlace(
        destination,
        createPlaceIndex([
          destination,
          { ...destination, id: "zip", kind: "postal" },
        ]),
      )?.id,
    ).toBe(destination.id);
  });
  it("preserves advertised-city basis without promoting a car location", () => {
    const l = routed();
    expect(l.vehicleLocation).toBeNull();
    expect(l.travel?.basis).toBe("advertised-city");
    expect(travelResult(l, defaultSearch(), now)).toMatchObject({
      status: "borderline",
      minutes: 230,
      basis: "advertised-city",
      low: 184,
      high: 253,
    });
    expect(travelEligible(l, defaultSearch(), now)).toBe(true);
    expect(
      travelEligible(l, { ...defaultSearch(), includeBorderline: false }, now),
    ).toBe(false);
  });
  it("uses the unrounded interval and conservative margin for cutoff decisions", () => {
    expect(travelResult(routed(218), defaultSearch(), now).status).toBe(
      "within",
    );
    expect(
      travelResult(
        routed(218),
        { ...defaultSearch(), planningBuffer: "conservative" },
        now,
      ).status,
    ).toBe("borderline");
    expect(travelResult(routed(340), defaultSearch(), now).status).toBe(
      "outside",
    );
    expect(
      travelResult(routed(230), { ...defaultSearch(), maxMinutes: 180 }, now)
        .status,
    ).toBe("outside");
  });
  it("uses extra buffer conservatively rather than admitting farther cars through a wider optimistic range", () => {
    const l = routed(260);
    expect(travelResult(l, defaultSearch(), now).status).toBe("borderline");
    const result = travelResult(
      l,
      { ...defaultSearch(), planningBuffer: "conservative" },
      now,
    );
    expect(result.low).toBe(260);
    expect(result.status).toBe("outside");
  });
  it("supports a strict reported-city cutoff and excludes advertised-only locations", () => {
    const s = { ...defaultSearch(), travelMode: "strict" as const };
    expect(travelResult(routed(120), s, now).status).toBe("unknown");
    const l = car();
    l.vehicleLocation = l.seller.location;
    for (const [minutes, status] of [
      [240, "within"],
      [240.01, "outside"],
    ] as const) {
      l.travel = resolveListingTravel(l, atlas(minutes));
      expect(travelResult(l, s, now).status).toBe(status);
    }
  });
  it("does not turn dealer location into an off-site or ambiguous vehicle route", () => {
    for (const precision of ["ambiguous", "region"] as const) {
      const l = car();
      l.vehicleLocation = { ...l.seller.location!, precision };
      l.travel = resolveListingTravel(l, atlas());
      expect(travelResult(l, defaultSearch(), now).status).toBe("unknown");
    }
    const l = car();
    l.routeUnknownReason = "Seller says vehicle is off-site";
    l.travel = resolveListingTravel(l, atlas());
    expect(l.travel.basis).toBe("offsite");
    expect(travelResult(l, defaultSearch(), now).status).toBe("unknown");
    expect(tripDestination(l)).toBeNull();
  });
  it("honors retained explicit off-site flags even when an older catalog replaced the reason text", () => {
    const l = car();
    l.flags = ["Off-site vehicle location unknown"];
    l.routeUnknownReason = "Actual location needs review";
    l.travel = resolveListingTravel(l, atlas(100));
    expect(l.travel.basis).toBe("offsite");
    expect(travelEligible(l, defaultSearch(), now)).toBe(false);
  });
  it("keeps a reviewed actual location usable after private review details are redacted", () => {
    const l = car();
    l.locationDisclosure = {
      status: "offsite",
      observedAt: date,
      sourceUrl: l.url,
    };
    l.vehicleLocation = l.seller.location;
    l.userOverrides = {
      vehicleLocation: l.vehicleLocation,
      reason: "Private inspection evidence",
      reviewedAt: date,
    };
    const publicRow = redactPublicListing(l);
    expect(publicRow.userOverrides).toBeUndefined();
    expect(JSON.stringify(publicRow)).not.toContain(
      "Private inspection evidence",
    );
    publicRow.travel = resolveListingTravel(publicRow, atlas(100));
    expect(publicRow.travel.basis).toBe("reviewed-location");
    expect(travelEligible(publicRow, defaultSearch(), now)).toBe(true);
  });
  it("keeps foreign destinations unresolved", () => {
    const l = car();
    l.seller.location!.country = "CA";
    expect(resolveListingTravel(l, atlas()).place).toBeNull();
    expect(matches(l, quickSearch("nationwide"), undefined, now)).toBe(false);
  });
  it("never applies a route from another origin or a changed destination point", () => {
    const l = routed(100);
    expect(
      travelResult(l, { ...defaultSearch(), originKey: "US:MI:detroit" }, now)
        .status,
    ).toBe("unknown");
    l.travel!.place = { ...destination, lat: destination.lat + 1 };
    expect(travelResult(l, defaultSearch(), now).status).toBe("unknown");
  });
  it("validates graph, options, points and unique route context at the artifact boundary", () => {
    const a = atlas();
    a.estimates[0].originPoint[0] += 1;
    expect(travelAtlasSchema.safeParse(a).success).toBe(false);
    const b = atlas();
    b.estimates.push({ ...b.estimates[0] });
    expect(travelAtlasSchema.safeParse(b).success).toBe(false);
    const c = atlas();
    c.estimates[0].graphVersion = "different";
    expect(travelAtlasSchema.safeParse(c).success).toBe(false);
  });
  it("rejects stale/future road evidence and excessive snapping even if recently repackaged", () => {
    for (const field of ["computedAt", "graphObservedAt"] as const) {
      const l = routed(100);
      l.travel!.estimates[0][field] = new Date(now - 181 * 864e5).toISOString();
      expect(travelResult(l, defaultSearch(), now).status).toBe("unknown");
      l.travel!.estimates[0][field] = new Date(now + 1).toISOString();
      expect(travelResult(l, defaultSearch(), now).status).toBe("unknown");
    }
    const l = routed(100);
    l.travel!.estimates[0].destinationSnapMeters = 2501;
    expect(travelResult(l, defaultSearch(), now).status).toBe("unknown");
  });
  it("routes shared city jobs once while retaining independent source ads", () => {
    const a = atlas(100),
      l = car(),
      other = { ...car(), id: "other", sourceId: "other" };
    const rows = projectTravel([l, other], a);
    expect(a.estimates).toHaveLength(1);
    expect(rows[0].travel?.estimates[0]).toEqual(rows[1].travel?.estimates[0]);
    expect(rows.map((l) => l.id)).toEqual(["car", "other"]);
  });
  it("bases regional shopping on road geography instead of collection provenance", () => {
    const l = routed(100);
    l.scope = "nationwide";
    expect(matches(l, quickSearch("regional"), undefined, now)).toBe(true);
    const distant = routed(500);
    distant.scope = "regional";
    expect(matches(distant, quickSearch("regional"), undefined, now)).toBe(
      false,
    );
  });
  it("keeps regional labels and eligibility on the selected limit after its broader preset", () => {
    expect(quickSearch("regional").maxMinutes).toBe(360);
    const l = routed(250);
    expect(
      matches(
        l,
        { ...quickSearch("regional"), maxMinutes: 180 },
        undefined,
        now,
      ),
    ).toBe(false);
    const offsite = car();
    offsite.flags = ["Off-site vehicle location unknown"];
    expect(matches(offsite, quickSearch("nationwide"), undefined, now)).toBe(
      true,
    );
  });
  it("keeps travel context through quick views and saved-search parsing", () => {
    const filters = {
      ...defaultSearch(),
      maxMinutes: 180,
      originKey: "US:WI:madison",
      includeBorderline: false,
    };
    expect(quickSearch("unknown-route", filters)).toMatchObject({
      originKey: filters.originKey,
      maxMinutes: 180,
      includeBorderline: false,
    });
  });
  it("requires complete matching legacy route context and invalidates moved vehicles", () => {
    const l = car();
    l.vehicleLocation = {
      ...l.seller.location!,
      lat: destination.lat,
      lon: destination.lon,
    };
    l.route = {
      minutes: 200,
      miles: 200,
      provider: "test",
      observedAt: date,
      origin: "Wheaton, IL",
      destination: "Traverse City, MI",
      options: "no ferries or borders",
      traffic: false,
      precision: "city",
      context: {
        originKey: placeKey(origin),
        originPoint: [origin.lon, origin.lat],
        destinationPoint: [destination.lon, destination.lat],
        profile: ROAD_PROFILE,
      },
    };
    expect(routeEvidenceKnown(l, now)).toBe(true);
    l.route.origin = "Los Angeles, CA";
    expect(routeEvidenceKnown(l, now)).toBe(false);
    l.route.origin = "Wheaton, IL";
    l.vehicleLocation.lat! += 1;
    expect(routeEvidenceKnown(l, now)).toBe(false);
    delete l.route.context;
    expect(routeEvidenceKnown(l, now)).toBe(false);
  });
  it("keeps browser, dictionary catalog and bounded API eligibility identical at one clock", async () => {
    const a = atlas(),
      l = car(),
      snapshot = {
        schemaVersion: 1,
        generatedAt: date,
        listings: [l],
        coverage: [],
        runs: [],
        limitations: [],
        travelAtlas: a,
      },
      s = defaultSearch(),
      workspace = emptyWorkspace();
    const browser = projectSnapshot(unpackCatalog(packCatalog(snapshot)), now);
    const expected = searchListings(browser.listings, s, workspace, now);
    async function* batches() {
      yield [{ payload: JSON.stringify(l) }];
    }
    const api = await searchPageFromBatches(s, 0, 20, {
      batches: batches(),
      workspace,
      staleDays: 14,
      auctionMaxAgeHours: 6,
      now,
      travelAtlas: a,
    });
    expect(api.rows.map((l) => l.id)).toEqual(expected.rows.map((l) => l.id));
    expect(api.rawCount).toBe(expected.rawCount);
  });
});
