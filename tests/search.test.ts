import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultSearch,
  listingSchema,
  type Listing,
  type Search,
} from "../shared/schema";
import {
  generation,
  identify,
  matches,
  potentialDuplicates,
  quickSearch,
  routeKnown,
  searchListings,
  storageKey,
  strongGroupKey,
  targetMatch,
} from "../shared/search";

// Independent acceptance tests. Some deliberately expose review findings in the
// current implementation; keep failures as requirements, not implementation snapshots.
const now = "2026-09-08T03:00:00.000Z";
const car = (id: string, overrides: Partial<Listing> = {}): Listing =>
  listingSchema.parse({
    id,
    sourceId: "fixture-dealer",
    sourceListingId: id,
    sourceName: "Fixture dealer",
    url: `https://example.com/cars/${id}`,
    title: "1969 Chevrolet Camaro",
    make: "Chevrolet",
    model: "Camaro",
    year: 1969,
    advertisedYear: "1969",
    saleType: "fixed",
    availability: "active",
    askingPrice: 25000,
    seller: { name: "Fixture Motors", type: "dealer" },
    vehicleLocation: {
      city: "Wheaton",
      state: "IL",
      country: "US",
      precision: "city",
      lat: 41.8661,
      lon: -88.107,
    },
    route: {
      minutes: 120,
      miles: 100,
      provider: "fixture-only",
      observedAt: now,
      origin: "Wheaton, IL",
      destination: "Wheaton, IL",
      options: "no ferries; no borders",
      traffic: false,
      precision: "city",
    },
    firstSeenAt: now,
    lastObservedAt: now,
    ...overrides,
  });
const search = (changes: Partial<Search> = {}): Search => ({
  ...defaultSearch(),
  ...changes,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
});
afterEach(() => vi.useRealTimers());

describe("classic identity and specialty branches", () => {
  it("keeps inclusive requested years and normalizes Camero queries", () => {
    expect(defaultSearch()).toMatchObject({
      minYear: 1960,
      maxYear: 1989,
      specialty: false,
    });
    expect(
      matches(car("first", { model: "Corvette", year: 1960 }), search()),
    ).toBe(true);
    expect(matches(car("last", { year: 1989 }), search())).toBe(true);
    expect(matches(car("after", { year: 1990 }), search())).toBe(false);
    expect(matches(car("typo"), search({ query: "Camero" }))).toBe(true);
  });

  it("preserves half-year text and reviews a bare 1964 assertion", () => {
    expect(identify("1964 1/2 Ford Mustang")).toMatchObject({
      year: 1965,
      advertisedYear: "1964 1/2",
      identityStatus: "consistent",
    });
    expect(identify("1964 Ford Mustang").identityStatus).toBe("review");
    expect(
      identify("1969 Ford Mustang advertised as 1970").identityStatus,
    ).toBe("review");
    expect(identify("Ford Mustang")).toMatchObject({
      year: null,
      identityStatus: "review",
    });
  });

  it("excludes impossible imported identities even when identity status was omitted", () => {
    expect(
      targetMatch(car("impossible-camaro", { year: 1960 }), search()),
    ).toBe(false);
    expect(
      targetMatch(
        car("impossible-mustang", { model: "Mustang", year: 1963 }),
        search(),
      ),
    ).toBe(false);
    expect(
      targetMatch(
        car("corvette-1983", { model: "Corvette", year: 1983 }),
        search(),
      ),
    ).toBe(false);
    expect(generation({ model: "Mustang", year: 1960 })).toBeNull();
    expect(generation({ model: "Corvette", year: 1950 })).toBeNull();
  });

  it("broadens only supported specialty Mustangs and restores scope when disabled", () => {
    const classic = car("classic");
    const cobra = car("cobra", {
      title: "2003 Ford Mustang SVT Cobra",
      model: "Mustang",
      year: 2003,
      specialty: "SVT/Cobra",
      specialtyEvidence: "document-supported",
    });
    const ordinary = car("ordinary", { model: "Mustang", year: 2017 });
    const laterCamaro = car("later-camaro", { year: 2017 });
    const laterCorvette = car("later-corvette", {
      model: "Corvette",
      year: 2017,
    });
    const listings = [classic, cobra, ordinary, laterCamaro, laterCorvette];
    expect(searchListings(listings, search()).rows.map((l) => l.id)).toEqual([
      "classic",
    ]);
    expect(
      searchListings(listings, search({ specialty: true }))
        .rows.map((l) => l.id)
        .sort(),
    ).toEqual(["classic", "cobra"]);
    expect(
      searchListings(listings, search({ specialty: false })).rows.map(
        (l) => l.id,
      ),
    ).toEqual(["classic"]);
    expect(matches(cobra, search({ specialty: true, maxPrice: 20000 }))).toBe(
      false,
    );
    expect(matches(cobra, search({ specialty: true, maxMinutes: 60 }))).toBe(
      false,
    );
  });

  it("separates unverified specialty claims and tributes from strict later specialty matches", () => {
    const claimed = car("claimed", {
      model: "Mustang",
      year: 2003,
      specialty: "SVT/Cobra",
      specialtyEvidence: "seller-claimed",
    });
    const unresolved = {
      ...claimed,
      id: "unresolved",
      specialtyEvidence: "unknown" as const,
    };
    const tribute = {
      ...claimed,
      id: "tribute",
      specialtyEvidence: "document-supported" as const,
      authenticity: "tribute" as const,
    };
    expect(matches(claimed, search({ specialty: true }))).toBe(false);
    expect(matches(tribute, search({ specialty: true }))).toBe(false);
    expect(matches(claimed, quickSearch("specialty-review"))).toBe(true);
    expect(matches(unresolved, quickSearch("specialty-review"))).toBe(true);
    expect(identify("1965 Shelby Cobra roadster").model).toBeNull();
  });
});

describe("travel and independent preferences", () => {
  it("includes exactly 240 minutes and rejects longer road routes despite close air distance", () => {
    const exact = car("exact");
    exact.route!.minutes = 240;
    const over = car("over");
    over.route!.minutes = 240.01;
    const lakeMichiganDetour = car("detour", { straightLineMiles: 150 });
    lakeMichiganDetour.route!.minutes = 310;
    expect(matches(exact, search())).toBe(true);
    expect(matches(over, search())).toBe(false);
    expect(matches(lakeMichiganDetour, search())).toBe(false);
  });

  it("keeps missing, ambiguous, off-site and expired routes in review", () => {
    const missing = car("missing", { route: null });
    const ambiguous = car("ambiguous");
    ambiguous.vehicleLocation!.precision = "ambiguous";
    const offsite = car("offsite");
    offsite.vehicleLocation!.offsite = true;
    const expired = car("expired");
    expired.route!.observedAt = "2026-07-01T00:00:00Z";
    for (const listing of [missing, ambiguous, offsite, expired]) {
      expect(routeKnown(listing)).toBe(false);
      expect(matches(listing, search())).toBe(false);
      expect(matches(listing, quickSearch("unknown-route"))).toBe(true);
    }
  });

  it("requires a real nonfuture observation and US location for strict travel", () => {
    const future = car("future");
    future.route!.observedAt = "2099-01-01T00:00:00Z";
    expect(routeKnown(future)).toBe(false);
    const foreign = car("foreign");
    foreign.vehicleLocation!.country = "CA";
    expect(matches(foreign, search())).toBe(false);
  });

  it("keeps nationwide independent of specialty and enforces US scope", () => {
    const distant = car("distant", { scope: "nationwide" });
    distant.route!.minutes = 1800;
    expect(matches(distant, quickSearch("nationwide"))).toBe(true);
    expect(quickSearch("nationwide").specialty).toBe(false);
    expect(
      matches(
        car("later", { model: "Mustang", year: 2017 }),
        quickSearch("nationwide"),
      ),
    ).toBe(false);
    const foreign = car("foreign");
    foreign.vehicleLocation!.country = "CA";
    expect(matches(foreign, quickSearch("nationwide"))).toBe(false);
  });

  it("combines states with OR and independent preferences with AND", () => {
    const wisconsin = car("wisconsin");
    wisconsin.vehicleLocation!.state = "WI";
    expect(matches(wisconsin, search({ states: ["IL", "WI"] }))).toBe(true);
    expect(
      matches(wisconsin, search({ states: ["IL", "WI"], maxPrice: 10000 })),
    ).toBe(false);
    expect(matches(wisconsin, search({ states: ["IN", "MI"] }))).toBe(false);
  });
});

describe("unknown values, sale types and grouping", () => {
  it("does not invent price or power and retains unknowns by default", () => {
    const unpriced = car("unpriced", {
      askingPrice: null,
      currentBid: 1000,
      specs: { displacementCI: { value: 350, basis: "seller-claimed" } },
    });
    expect(matches(unpriced, search())).toBe(true);
    expect(matches(unpriced, search({ unknownPrice: false }))).toBe(false);
    expect(
      matches(
        unpriced,
        search({
          rules: [{ field: "specs.horsepower", operator: "min", value: 300 }],
        }),
      ),
    ).toBe(false);
    expect(
      matches(
        unpriced,
        search({ rules: [{ field: "specs.horsepower", operator: "unknown" }] }),
      ),
    ).toBe(true);
    expect(matches(car("auction", { saleType: "auction" }), search())).toBe(
      false,
    );
  });

  it("treats seller text Unknown as unknown and resolves nested filter fields", () => {
    const unknownMileage = car("unknown-mileage", {
      specs: { mileageStatus: { value: "Unknown", basis: "seller-claimed" } },
    });
    expect(
      matches(
        unknownMileage,
        search({
          rules: [{ field: "specs.mileageStatus", operator: "unknown" }],
        }),
      ),
    ).toBe(true);
    expect(
      matches(
        car("dealer"),
        search({
          rules: [
            { field: "seller.type", operator: "include", value: "dealer" },
          ],
        }),
      ),
    ).toBe(true);
  });

  it("groups compatible full historical identity but never masked or partial identifiers", () => {
    expect(
      strongGroupKey(
        car("historical", {
          model: "Mustang",
          year: 1965,
          identifier: "5F07C123456",
          stockNumber: null,
        }),
      ),
    ).not.toBeNull();
    expect(
      strongGroupKey(
        car("partial", {
          year: 1989,
          identifier: "KF123456",
          stockNumber: null,
        }),
      ),
    ).toBeNull();
    expect(
      strongGroupKey(
        car("masked", {
          year: 1989,
          identifier: "XX12345678",
          stockNumber: null,
        }),
      ),
    ).toBeNull();
    expect(
      strongGroupKey(
        car("private-stock", {
          identifier: null,
          stockNumber: "123",
          seller: { name: "Private Seller", type: "private", location: null },
        }),
      ),
    ).toBeNull();
  });

  it("keeps generic lookalikes separate without flooding evidence review", () => {
    const a = car("a");
    const b = car("b");
    expect(potentialDuplicates([a, b])).toEqual([]);
    expect(searchListings([a, b], search())).toMatchObject({
      rawCount: 2,
      groupCount: 2,
    });
    expect(
      searchListings(
        [
          { ...a, groupId: "reviewed-pair" },
          { ...b, groupId: "reviewed-pair" },
        ],
        search(),
      ),
    ).toMatchObject({ rawCount: 2, groupCount: 1 });
  });

  it("isolates application, deployment path and connection mode storage", () => {
    const keys = [
      storageKey("/", "sample"),
      storageKey("/", "snapshot"),
      storageKey("/ClassicCars", "snapshot"),
      storageKey("/ClassicCars", "connected", "https://api.example.com"),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => key.startsWith("musclescout:"))).toBe(true);
  });
});
