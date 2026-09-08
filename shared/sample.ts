import { listingSchema, type Listing } from "./schema";
const date = "2026-09-08T02:00:00.000Z";
const make = (
  id: string,
  title: string,
  price: number | null,
  extra: Partial<Listing> = {},
): Listing =>
  listingSchema.parse({
    id: `sample:${id}`,
    sourceId: "sample",
    sourceListingId: id,
    sourceName: "Fictional examples",
    url: "https://example.com/fictional/" + id,
    title,
    description:
      "Fictional example for exploring MuscleScout. This car is not for sale.",
    originalSellerText: "Fictional example — no actual seller.",
    make: title.includes("Mustang") ? "Ford" : "Chevrolet",
    model: title.includes("Mustang")
      ? "Mustang"
      : title.includes("Camaro")
        ? "Camaro"
        : "Corvette",
    year: Number(title.slice(0, 4)),
    advertisedYear: title.slice(0, 4),
    askingPrice: price,
    saleType: "fixed",
    availability: "active",
    seller: { name: "Fictional seller", type: "private" },
    vehicleLocation: {
      city: "Wheaton",
      state: "IL",
      precision: "city",
      lat: 41.8661,
      lon: -88.107,
    },
    firstSeenAt: date,
    lastObservedAt: date,
    isSample: true,
    ...extra,
  });
export const sampleListings: Listing[] = [
  make("mustang", "1967 Ford Mustang Fastback", 45900, {
    specs: {
      transmission: { value: "Manual", basis: "seller-claimed" },
      engineInstalled: { value: "289 V8", basis: "seller-claimed" },
      cylinders: { value: 8, basis: "seller-claimed" },
    },
    route: {
      minutes: 78,
      miles: 61,
      provider: "Fictional test route",
      observedAt: date,
      origin: "Wheaton, IL",
      destination: "Fictional location",
      options: "Sample only",
      traffic: false,
      precision: "city",
    },
  }),
  make("camaro", "1969 Chevrolet Camaro SS", 58900, {
    specs: {
      transmission: { value: "Automatic", basis: "seller-claimed" },
      mileageStatus: { value: "Unknown", basis: "seller-claimed" },
    },
  }),
  make("corvette", "1972 Chevrolet Corvette", 32950),
  make("cobra", "2003 Ford Mustang SVT Cobra", 31900, {
    specialty: "SVT/Cobra",
    specialtyEvidence: "document-supported",
  }),
  make("ordinary", "2017 Ford Mustang GT", 27000),
  make("latercamaro", "2010 Chevrolet Camaro", 19900),
  make("unknown", "Ford Mustang · year unknown", 8500, {
    year: null,
    identityStatus: "review",
    identityNotes: ["Advertised model year is missing."],
  }),
];
