import {
  listingSchema,
  emptyWorkspace,
  defaultSearch,
  searchSchema,
  type Listing,
  type Search,
} from "../../shared/schema";
import { quickSearch } from "../../shared/search";
export const BENCHMARK_NOW = Date.parse("2026-09-08T12:00:00Z");
const iso = (value: number) => new Date(value).toISOString();
/** Entirely synthetic advertisements, never imported or exported as real inventory. */
export function scaleFixture(count = 50000, now = BENCHMARK_NOW): Listing[] {
  const baseline = listingSchema.parse({
    id: "benchmark:template",
    sourceId: "benchmark",
    sourceName: "Synthetic source",
    sourceListingId: "template",
    url: "https://example.com/synthetic/template",
    title: "1969 Chevrolet Camaro",
    model: "Camaro",
    year: 1969,
    saleType: "fixed",
    availability: "active",
    seller: { name: "Synthetic dealer", type: "dealer" },
    firstSeenAt: iso(now),
    lastObservedAt: iso(now),
  });
  return Array.from({ length: count }, (_, index) => {
    const vehicle = Math.floor(index / 2),
      model = (["Mustang", "Camaro", "Corvette"] as const)[vehicle % 3],
      later = model === "Mustang" && vehicle % 9 === 0,
      year = later ? 2003 + (vehicle % 22) : 1967 + (vehicle % 23);
    const id = `benchmark:${String(index).padStart(7, "0")}`,
      url = `https://example.com/synthetic/ads/${index}`,
      sourceId = `benchmark-source-${index % 8}`;
    const ageHours =
      vehicle % 13 === 0 ? 24 * 31 : vehicle % 17 === 0 ? -1 : vehicle % 11;
    const observedAt = iso(now - ageHours * 36e5),
      routeAge = vehicle % 7 === 0 ? 31 : vehicle % 11 === 0 ? -1 : 1;
    const auction = vehicle % 11 === 0,
      phase = vehicle % 4,
      state = ["IL", "MI", "CA", "TX"][vehicle % 4];
    const specs = Object.fromEntries(
      Object.entries({
        engine: vehicle % 2 ? "V8 350" : "V8 289",
        transmission: vehicle % 3 ? "Manual" : "Automatic",
        exteriorColor: ["Red", "Blue", "Black", "White"][vehicle % 4],
        interiorColor: vehicle % 2 ? "Black" : "Tan",
        mileage: 10000 + vehicle * 37,
        bodyStyle: "Coupe",
      }).map(([key, value]) => [
        key,
        {
          value,
          basis: "seller-claimed" as const,
          sourceUrl: url,
          observedAt,
          note: `Synthetic ${key} evidence for benchmarking only. Repeated explanatory provenance text measures safe detail deferral without changing value-based predicates.`,
        },
      ]),
    );
    const location =
      vehicle % 10 === 0
        ? null
        : {
            city: `Synthetic City ${vehicle % 200}`,
            state,
            country: vehicle % 19 === 0 ? "CA" : "US",
            precision:
              vehicle % 23 === 0 ? ("ambiguous" as const) : ("city" as const),
            offsite: vehicle % 29 === 0,
            lat: 41 + (vehicle % 100) / 100,
            lon: -88,
          };
    const listing: Listing = {
      ...baseline,
      id,
      sourceId,
      sourceName: `Synthetic source ${index % 8}`,
      sourceListingId: String(index),
      url,
      model,
      make: model === "Mustang" ? "Ford" : "Chevrolet",
      year,
      title: `${year} ${model === "Mustang" ? "Ford" : "Chevrolet"} ${model}`,
      description: `Synthetic ${model} advertisement for performance measurement only. ${vehicle % 2 ? "Manual V8" : "Automatic V8"}. Source statements remain unverified.`,
      originalSellerText: `Synthetic original text ${vehicle}: advertised seller claims and long-form vehicle narrative. This text is never a real car observation.`,
      specialty: later ? "SVT/Cobra" : null,
      specialtyEvidence: later
        ? vehicle % 4 === 0
          ? "seller-claimed"
          : "document-supported"
        : "unknown",
      authenticity: later && vehicle % 5 === 0 ? "clone" : "factory-claimed",
      identityStatus: vehicle % 31 === 0 ? "review" : "consistent",
      askingPrice:
        auction || vehicle % 7 === 0
          ? null
          : 20000 + (vehicle % 150) * 1000 + (index % 2) * 500,
      priceOnRequest: !auction && vehicle % 7 === 0,
      saleType: auction
        ? "auction"
        : vehicle % 3 === 0
          ? "negotiable"
          : "fixed",
      availability: auction
        ? phase === 0
          ? "unknown"
          : phase === 1
            ? "upcoming-auction"
            : "live-auction"
        : vehicle % 37 === 0
          ? "sold"
          : "active",
      currentBid: auction ? 15000 + (vehicle % 40) * 500 : null,
      buyItNow: auction && vehicle % 5 === 0 ? 45000 : null,
      auctionStart: auction ? iso(now + (phase === 1 ? 2 : -12) * 36e5) : null,
      auctionEnd: auction ? iso(now + (phase === 3 ? -1 : 12) * 36e5) : null,
      auctionTimezone: auction ? "America/Chicago" : null,
      seller: {
        name: `Synthetic dealer ${vehicle % 200}`,
        type: "dealer",
        location,
      },
      vehicleLocation: location,
      route:
        location && vehicle % 6 !== 0
          ? {
              minutes: [239.999, 240, 240.001, 360][vehicle % 4],
              miles: 160 + (vehicle % 200),
              provider: "synthetic-fixture",
              observedAt: iso(now - routeAge * 864e5),
              origin: "synthetic-home",
              destination: `synthetic-city-${vehicle % 200}`,
              options: "no-ferries; no-borders; non-traffic",
              traffic: false,
              precision: "city",
            }
          : null,
      straightLineMiles: vehicle % 300,
      specs,
      fieldEvidence: {
        askingPrice: {
          value: auction ? null : 20000 + (vehicle % 150) * 1000,
          basis: "parsed",
          sourceUrl: url,
          observedAt,
          note: "Synthetic asking-price provenance; not an actual market observation.",
        },
      },
      photos: [0, 1, 2, 3].map(
        (photo) =>
          `https://example.com/synthetic/images/${vehicle}/photo-${photo}.jpg`,
      ),
      evidenceRef: `synthetic-hash-${vehicle}`,
      identifier:
        vehicle % 3 === 0
          ? `1FA1P8CF5F${String(vehicle).padStart(7, "0")}`
          : null,
      stockNumber: `S-${String(vehicle).padStart(7, "0")}`,
      firstSeenAt: iso(now - (vehicle % 50) * 864e5),
      lastObservedAt: observedAt,
      lastNetworkCheckedAt: observedAt,
      parserVersion: "synthetic-benchmark-v1",
      scope: vehicle % 2 ? "regional" : "nationwide",
      groupId: vehicle % 10 === 0 ? `synthetic-group:${vehicle}` : null,
      userOverrides:
        vehicle % 41 === 0
          ? { year, reason: "Synthetic review reason", reviewedAt: observedAt }
          : undefined,
    };
    return listing;
  });
}
export function scaleWorkspace(listings: Listing[]) {
  return {
    ...emptyWorkspace(),
    favorites: listings.filter((_, index) => index % 97 === 0).map((l) => l.id),
  };
}
export function scaleQueries(): { name: string; filters: Search }[] {
  const all = { availability: [], saleTypes: [], grouped: false },
    nationwide = { ...quickSearch("nationwide"), ...all };
  return [
    { name: "strict-240-minute-boundary", filters: defaultSearch() },
    { name: "unknown-route", filters: quickSearch("unknown-route") },
    { name: "nationwide-grouped", filters: { ...nationwide, grouped: true } },
    {
      name: "nationwide-price-known",
      filters: {
        ...nationwide,
        minPrice: 30000,
        maxPrice: 65000,
        unknownPrice: false,
        sort: "price-asc",
      },
    },
    { name: "live-upcoming-auctions", filters: quickSearch("auctions") },
    {
      name: "supported-specialty-common-filters",
      filters: {
        ...nationwide,
        specialty: true,
        variants: ["SVT/Cobra"],
        maxPrice: 85000,
        states: ["IL", "TX"],
        sort: "year",
      },
    },
    { name: "identity-review", filters: quickSearch("identity-review") },
    {
      name: "specialty-seller-claim-review",
      filters: quickSearch("specialty-review"),
    },
    { name: "favorites", filters: { ...nationwide, favoritesOnly: true } },
    {
      name: "engine-rule",
      filters: {
        ...nationwide,
        rules: [{ field: "specs.engine", operator: "include", value: "289" }],
      },
    },
    {
      name: "gallery-length-rule",
      filters: {
        ...nationwide,
        rules: [{ field: "photos.length", operator: "min", value: 3 }],
      },
    },
    {
      name: "exact-second-photo-rule",
      filters: {
        ...nationwide,
        rules: [{ field: "photos.1", operator: "include", value: "photo-1" }],
      },
    },
    {
      name: "field-evidence-rule",
      filters: {
        ...nationwide,
        rules: [
          {
            field: "fieldEvidence.askingPrice.basis",
            operator: "include",
            value: "parsed",
          },
        ],
      },
    },
    {
      name: "original-source-text-rule",
      filters: {
        ...nationwide,
        rules: [
          {
            field: "originalSellerText",
            operator: "include",
            value: "original text",
          },
        ],
      },
    },
    {
      name: "review-reason-rule",
      filters: {
        ...nationwide,
        rules: [{ field: "userOverrides.reason", operator: "known" }],
      },
    },
    {
      name: "query-and-source-filter",
      filters: {
        ...nationwide,
        query: "camero V8",
        sources: ["benchmark-source-0", "benchmark-source-1"],
        maxAgeDays: 7,
      },
    },
  ].map((q) => ({ name: q.name, filters: searchSchema.parse(q.filters) }));
}
