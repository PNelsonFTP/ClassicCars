import { z } from "zod";
export const SCHEMA_VERSION = 1;
export const DEFAULTS_VERSION = 1;
export const modelSchema = z.enum(["Mustang", "Camaro", "Corvette"]);
export const locationSchema = z.object({
  city: z.string(),
  state: z.string(),
  country: z.string().default("US"),
  postalCode: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  precision: z
    .enum(["exact", "postal", "city", "region", "ambiguous", "unknown"])
    .default("unknown"),
  provider: z.string().optional(),
  observedAt: z.string().optional(),
  offsite: z.boolean().default(false),
});
export const evidenceSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  basis: z
    .enum([
      "seller-claimed",
      "document-supported",
      "user-reviewed",
      "parsed",
      "unknown",
    ])
    .default("seller-claimed"),
  sourceUrl: z.string().url().optional(),
  observedAt: z.string().optional(),
  note: z.string().optional(),
});
export const listingSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  id: z.string().min(1).max(200),
  sourceId: z.string().min(1),
  sourceListingId: z.string().min(1),
  sourceName: z.string(),
  url: z
    .string()
    .url()
    .refine((v) => v.startsWith("https://"), "Listing URLs must use HTTPS"),
  title: z.string().min(1).max(500),
  description: z.string().max(60000).default(""),
  originalSellerText: z.string().max(60000).default(""),
  make: z.string().nullable().default(null),
  model: modelSchema.nullable().default(null),
  year: z.number().int().min(1885).max(2100).nullable().default(null),
  advertisedYear: z.string().nullable().default(null),
  generation: z.string().nullable().default(null),
  trim: z.string().nullable().default(null),
  identityStatus: z.enum(["consistent", "review"]).default("consistent"),
  identityNotes: z.array(z.string()).default([]),
  specialty: z
    .enum(["SVT/Cobra", "Shelby GT350/GT500", "Mach 1", "Boss", "GTD"])
    .nullable()
    .default(null),
  specialtyEvidence: z
    .enum(["seller-claimed", "document-supported", "user-reviewed", "unknown"])
    .default("unknown"),
  authenticity: z
    .enum(["factory-claimed", "tribute", "clone", "replica", "unknown"])
    .default("unknown"),
  identifier: z.string().max(100).nullable().default(null),
  stockNumber: z.string().nullable().default(null),
  saleType: z
    .enum(["fixed", "negotiable", "auction", "unknown"])
    .default("unknown"),
  availability: z
    .enum([
      "active",
      "pending",
      "sold",
      "removed",
      "stale",
      "upcoming-auction",
      "live-auction",
      "auction-ended",
      "unknown",
    ])
    .default("unknown"),
  askingPrice: z.number().nonnegative().nullable().default(null),
  currency: z.string().default("USD"),
  priceOnRequest: z.boolean().default(false),
  currentBid: z.number().nonnegative().nullable().default(null),
  buyItNow: z.number().nonnegative().nullable().default(null),
  auctionEnd: z.string().nullable().default(null),
  auctionTimezone: z.string().nullable().default(null),
  reserveStatus: z.string().nullable().default(null),
  auctionOutcome: z.string().nullable().default(null),
  buyerPremium: z.string().nullable().default(null),
  disclosedFees: z.number().nullable().default(null),
  seller: z.object({
    name: z.string(),
    type: z
      .enum(["private", "dealer", "consignment", "auction", "unknown"])
      .default("unknown"),
    location: locationSchema.nullable().default(null),
  }),
  vehicleLocation: locationSchema.nullable().default(null),
  route: z
    .object({
      minutes: z.number().nonnegative(),
      miles: z.number().nonnegative(),
      provider: z.string(),
      observedAt: z.string(),
      origin: z.string(),
      destination: z.string(),
      options: z.string(),
      traffic: z.boolean().default(false),
      precision: z.string(),
    })
    .nullable()
    .default(null),
  straightLineMiles: z.number().nonnegative().nullable().default(null),
  routeUnknownReason: z
    .string()
    .default("Driving route has not been established."),
  userOverrides: z
    .object({
      year: z.number().int().nullable().optional(),
      identityStatus: z.enum(["consistent", "review"]).optional(),
      specialtyEvidence: z
        .enum([
          "unknown",
          "seller-claimed",
          "document-supported",
          "user-reviewed",
        ])
        .optional(),
      vehicleLocation: locationSchema.nullable().optional(),
      reviewedAt: z.string(),
    })
    .optional(),
  lastDetailAttemptAt: z.string().nullable().default(null),
  lastDetailObservedAt: z.string().nullable().default(null),
  fieldEvidence: z.record(z.string(), evidenceSchema).default({}),
  specs: z.record(z.string(), evidenceSchema).default({}),
  photos: z.array(z.string().url()).max(100).default([]),
  videoCount: z.number().int().nonnegative().nullable().default(null),
  flags: z.array(z.string()).default([]),
  firstSeenAt: z.string(),
  lastObservedAt: z.string(),
  lastNetworkCheckedAt: z.string().nullable().default(null),
  sellerPostedAt: z.string().nullable().default(null),
  statusEvidence: z.string().nullable().default(null),
  evidenceRef: z.string().optional(),
  parserVersion: z.string().default("manual-v1"),
  scope: z.enum(["regional", "nationwide"]).default("regional"),
  isSample: z.boolean().default(false),
  groupId: z.string().nullable().default(null),
});
export type Listing = z.infer<typeof listingSchema>;
export type Location = z.infer<typeof locationSchema>;
export const ruleSchema = z.object({
  field: z.string(),
  operator: z.enum(["include", "exclude", "known", "unknown", "min", "max"]),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});
export const searchSchema = z.object({
  mode: z
    .enum([
      "everyday",
      "unknown-route",
      "regional",
      "nationwide",
      "identity-review",
      "specialty-review",
      "auctions",
    ])
    .default("everyday"),
  models: z.array(modelSchema).default(["Mustang", "Camaro", "Corvette"]),
  minYear: z.number().int().default(1960),
  maxYear: z.number().int().default(1989),
  specialty: z.boolean().default(false),
  variants: z.array(z.string()).default(["SVT/Cobra"]),
  specialtyMaxYear: z.number().int().min(1960).max(2100).default(2027),
  routeMaxAgeDays: z.number().min(1).default(30),
  maxMinutes: z.number().nonnegative().default(240),
  discoveryMiles: z.number().positive().default(300),
  query: z.string().default(""),
  excludeText: z.string().default(""),
  minPrice: z.number().nonnegative().nullable().default(null),
  maxPrice: z.number().nonnegative().nullable().default(null),
  unknownPrice: z.boolean().default(true),
  states: z.array(z.string()).default([]),
  sources: z.array(z.string()).default([]),
  availability: z.array(z.string()).default(["active"]),
  saleTypes: z.array(z.string()).default(["fixed", "negotiable"]),
  rules: z.array(ruleSchema).default([]),
  sort: z
    .enum(["nearest", "price-asc", "price-desc", "newest", "year", "deadline"])
    .default("nearest"),
  grouped: z.boolean().default(true),
  favoritesOnly: z.boolean().default(false),
  maxAgeDays: z.number().nonnegative().nullable().default(null),
});
export type Search = z.infer<typeof searchSchema>;
export const defaultSearch = (): Search => searchSchema.parse({});
export const savedSearchSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  filters: searchSchema,
  defaultsVersion: z.number().default(1),
  schedule: z.enum(["off", "hourly", "daily"]).default("daily"),
  delivery: z.enum(["in-app", "webhook", "email"]).default("in-app"),
  bidAlerts: z.boolean().default(false),
  deadlineAlerts: z.boolean().default(false),
});
export const workspaceSchema = z.object({
  favorites: z.array(z.string()).default([]),
  notes: z.record(z.string(), z.string().max(20000)).default({}),
  flags: z.record(z.string(), z.string()).default({}),
  corrections: z
    .record(z.string(), z.record(z.string(), z.string()))
    .default({}),
  compare: z.array(z.string()).max(6).default([]),
  savedComparisons: z
    .array(z.object({ name: z.string(), ids: z.array(z.string()).max(6) }))
    .default([]),
  searches: z.array(savedSearchSchema).default([]),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export const emptyWorkspace = (): Workspace => workspaceSchema.parse({});
export const settingsSchema = z.object({
  home: locationSchema.default({
    city: "Wheaton",
    state: "IL",
    country: "US",
    precision: "unknown",
    offsite: false,
  }),
  discoveryMiles: z.number().min(1).max(5000).default(300),
  maxPages: z.number().int().min(1).max(100).default(5),
  maxDetails: z.number().int().min(1).max(500).default(50),
  cacheHours: z.number().min(1).default(24),
  staleDays: z.number().min(1).default(14),
  routeMaxAgeDays: z.number().min(1).default(30),
  specialtyMaxYear: z.number().int().min(1960).max(2100).default(2027),
  specialtyYearReference: z
    .string()
    .default(
      "https://www.fromtheroad.ford.com/us/en/articles/2026/mustang-gtd-applications-open-april-17",
    ),
  specialtyYearReviewedAt: z.string().default("2026-09-08"),
  enabledSources: z.array(z.string()).default([]),
  snapshotExcludeSources: z.array(z.string()).default(["autotrader"]),
  nationwideEnabled: z.boolean().default(false),
  collectionIntervalHours: z.number().min(1).default(24),
  webhookEnabled: z.boolean().default(false),
  emailEnabled: z.boolean().default(false),
});
export type Settings = z.infer<typeof settingsSchema>;
export type Coverage = {
  id: string;
  name: string;
  category: string;
  url: string;
  status: string;
  scope: string;
  note: string;
  count?: number;
  lastObservedAt?: string;
  pages?: number;
  details?: number;
};
export type Snapshot = {
  schemaVersion: 1;
  generatedAt: string | null;
  listings: Listing[];
  coverage: Coverage[];
  runs: Record<string, unknown>[];
  limitations: string[];
  collectionCounts?: { rawAds: number; groups: number; publicAds: number };
};
