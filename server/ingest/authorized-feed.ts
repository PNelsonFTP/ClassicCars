import { z } from "zod";
import {
  listingSchema,
  locationSchema,
  type Listing,
} from "../../shared/schema";
import { identify, generation } from "../../shared/search";

const stamp = z.string().datetime({ offset: true });
const money = z.number().finite().nonnegative().nullable();
const webUrl = z
  .string()
  .url()
  .refine((v) => {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      (!u.port || u.port === "443")
    );
  }, "Use an HTTPS URL without embedded credentials");
export const feedManifestSchema = z.object({
  schemaVersion: z.literal(1),
  feedId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/),
  sourceId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/),
  sourceName: z.string().min(1).max(200),
  generatedAt: stamp,
  scope: z.enum(["regional", "nationwide"]),
  query: z.string().min(1).max(1000),
  authorization: z.object({
    basis: z.enum([
      "provider-license",
      "dealer-permission",
      "user-owned-records",
    ]),
    reference: z.string().min(1).max(2000),
    reviewedAt: stamp,
    expiresAt: stamp.nullable().default(null),
    publicRedistribution: z.boolean().default(false),
    imageRedistribution: z.boolean().default(false),
  }),
  allowedListingHosts: z
    .array(z.string().regex(/^[a-z0-9.-]+$/))
    .min(1)
    .max(100),
  allowedImageHosts: z
    .array(z.string().regex(/^[a-z0-9.-]+$/))
    .max(100)
    .default([]),
  pagination: z
    .object({
      cursor: z.string().max(1000).nullable(),
      nextCursor: z.string().max(1000).nullable(),
      terminal: z.boolean(),
      declaredTotal: z.number().int().nonnegative().nullable().default(null),
    })
    .refine(
      (p) => !p.terminal || p.nextCursor === null,
      "Terminal pages cannot claim a next cursor",
    ),
});
export const feedRowSchema = z.object({
  sourceListingId: z.string().min(1).max(120),
  url: webUrl,
  wholeVehicle: z.literal(true),
  title: z.string().min(1).max(500),
  observedAt: stamp,
  description: z.string().max(60000).default(""),
  identifier: z.string().max(100).nullable().default(null),
  stockNumber: z.string().max(100).nullable().default(null),
  seller: z.object({
    name: z.string().max(300),
    type: z
      .enum(["private", "dealer", "consignment", "auction", "unknown"])
      .default("unknown"),
    location: locationSchema.nullable().default(null),
  }),
  vehicleLocation: locationSchema.nullable().default(null),
  specialty: listingSchema.shape.specialty,
  specialtyEvidence: listingSchema.shape.specialtyEvidence,
  specialtyEvidenceReference: webUrl.nullable().default(null),
  authenticity: listingSchema.shape.authenticity,
  saleType: listingSchema.shape.saleType,
  availability: listingSchema.shape.availability,
  askingPrice: money.default(null),
  currentBid: money.default(null),
  buyItNow: money.default(null),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default("USD"),
  auctionStart: stamp.nullable().default(null),
  auctionEnd: stamp.nullable().default(null),
  auctionTimezone: z.string().nullable().default(null),
  reserveStatus: z
    .enum(["met", "not-met", "no-reserve", "unknown"])
    .default("unknown"),
  auctionOutcome: z
    .enum(["sold", "not-sold", "withdrawn", "unknown"])
    .default("unknown"),
  buyerPremium: z.string().max(1000).nullable().default(null),
  disclosedFees: money.default(null),
  photos: z.array(webUrl).max(100).default([]),
});
export type FeedManifest = z.infer<typeof feedManifestSchema>;

// A dry-run parser: no requests, database writes, feed authorization grants or deletion inference.
export function parseAuthorizedFeed(raw: unknown, now = new Date()) {
  const envelope = z
    .object({
      manifest: feedManifestSchema,
      listings: z.array(z.unknown()).max(10000),
    })
    .parse(raw);
  const { manifest } = envelope;
  if (Date.parse(manifest.generatedAt) > now.getTime())
    throw new Error("Feed generation timestamp is in the future");
  if (Date.parse(manifest.authorization.reviewedAt) > now.getTime())
    throw new Error("Authorization review timestamp is in the future");
  if (
    manifest.authorization.expiresAt &&
    Date.parse(manifest.authorization.expiresAt) <= now.getTime()
  )
    throw new Error("Feed authorization has expired");
  const listings: Listing[] = [],
    rejected: { index: number; reason: string }[] = [],
    ids = new Set<string>();
  for (const [index, input] of envelope.listings.entries()) {
    try {
      const row = feedRowSchema.parse(input);
      if (ids.has(row.sourceListingId))
        throw new Error("Duplicate source listing ID in this feed page");
      if (!manifest.allowedListingHosts.includes(new URL(row.url).hostname))
        throw new Error("Listing host is outside the manifest allowlist");
      if (
        row.photos.some(
          (url) => !manifest.allowedImageHosts.includes(new URL(url).hostname),
        )
      )
        throw new Error("Image host is outside the manifest allowlist");
      if (Date.parse(row.observedAt) > Date.parse(manifest.generatedAt))
        throw new Error("Observation is newer than the feed generation time");
      if (row.saleType === "auction" && row.askingPrice !== null)
        throw new Error(
          "Auction askingPrice must be null; use currentBid and buyItNow independently",
        );
      if (
        row.saleType !== "auction" &&
        (row.currentBid !== null || row.auctionStart || row.auctionEnd)
      )
        throw new Error("Auction fields require auction sale type");
      if (
        row.auctionStart &&
        row.auctionEnd &&
        Date.parse(row.auctionStart) >= Date.parse(row.auctionEnd)
      )
        throw new Error("Auction end must follow its start");
      if (
        row.specialtyEvidence === "document-supported" &&
        !row.specialtyEvidenceReference
      )
        throw new Error(
          "Supported specialty claims require a document reference",
        );
      const identity = identify(row.title);
      if (!identity.model)
        throw new Error("Title does not identify a supported vehicle model");
      if (!row.specialty && identity.model === "Mustang") {
        row.specialty = /\bGTD\b/i.test(row.title)
          ? "GTD"
          : /Shelby|GT[ -]?(350|500)/i.test(row.title)
            ? "Shelby GT350/GT500"
            : /Mach\s*1/i.test(row.title)
              ? "Mach 1"
              : /\bBoss\b/i.test(row.title)
                ? "Boss"
                : /\b(SVT|Cobra)\b/i.test(row.title) &&
                    identity.year &&
                    identity.year >= 1993 &&
                    identity.year <= 2004
                  ? "SVT/Cobra"
                  : null;
        if (row.specialty) row.specialtyEvidence = "seller-claimed";
      }
      if (
        /\b(tribute|clone|replica)\b/i.test(row.title) &&
        row.authenticity === "unknown"
      )
        row.authenticity = /tribute/i.test(row.title)
          ? "tribute"
          : /clone/i.test(row.title)
            ? "clone"
            : "replica";
      let availability = row.availability;
      const at = Date.parse(row.observedAt);
      if (row.saleType === "auction") {
        // Dates bound a declared phase. Missing/unknown phase never becomes live.
        if (
          row.auctionEnd &&
          Date.parse(row.auctionEnd) <= at &&
          !["sold", "removed"].includes(availability)
        )
          availability = "auction-ended";
        else if (row.auctionStart && Date.parse(row.auctionStart) > at)
          availability = "upcoming-auction";
        else if (
          availability === "live-auction" &&
          (!row.auctionEnd || Date.parse(row.auctionEnd) <= at)
        )
          availability = "unknown";
        else if (availability === "active") availability = "unknown";
      }
      const evidence = (
        value: string | number | boolean | null,
        note?: string,
      ) => ({
        value,
        sourceUrl: row.url,
        observedAt: row.observedAt,
        basis: "parsed" as const,
        note,
      });
      const fields = Object.fromEntries(
        [
          "askingPrice",
          "currentBid",
          "buyItNow",
          "currency",
          "auctionEnd",
          "reserveStatus",
          "auctionOutcome",
          "buyerPremium",
          "disclosedFees",
          "availability",
        ].map((key) => [
          key,
          evidence(
            key === "availability"
              ? availability
              : (row[key as keyof typeof row] as string | number | null),
          ),
        ]),
      );
      fields["feed.authorization"] = evidence(
        manifest.authorization.reference,
        `Feed ${manifest.feedId}; ${manifest.authorization.basis}; reviewed ${manifest.authorization.reviewedAt}`,
      );
      fields["feed.authorizationExpiresAt"] = evidence(
        manifest.authorization.expiresAt,
      );
      fields["feed.publicRedistribution"] = evidence(
        manifest.authorization.publicRedistribution,
      );
      fields["feed.imageRedistribution"] = evidence(
        manifest.authorization.imageRedistribution,
      );
      fields["feed.query"] = evidence(
        manifest.query,
        `Declared ${manifest.scope} query; terminal page does not prove wider completeness`,
      );
      if (row.specialtyEvidenceReference)
        fields["specialty"] = {
          ...evidence(row.specialty, row.specialtyEvidenceReference),
          basis: "parsed",
        };
      listings.push(
        listingSchema.parse({
          ...row,
          ...identity,
          id: `${manifest.sourceId}:${row.sourceListingId}`,
          sourceId: manifest.sourceId,
          sourceName: manifest.sourceName,
          originalSellerText: row.description || row.title,
          make: identity.model === "Mustang" ? "Ford" : "Chevrolet",
          generation: generation(identity),
          availability,
          firstSeenAt: row.observedAt,
          lastObservedAt: row.observedAt,
          lastNetworkCheckedAt: null,
          fieldEvidence: fields,
          scope: manifest.scope,
          flags: [
            "Imported from an authorized feed",
            ...(manifest.authorization.publicRedistribution
              ? []
              : ["Private feed: excluded from public snapshots"]),
          ],
          routeUnknownReason:
            "Driving route has not been established from feed location evidence.",
          parserVersion: "authorized-feed-v1",
        }),
      );
      ids.add(row.sourceListingId);
    } catch (error) {
      rejected.push({ index, reason: (error as Error).message });
    }
  }
  return {
    manifest,
    listings,
    rejected,
    coverage: {
      scope: manifest.scope,
      query: manifest.query,
      terminalPage: manifest.pagination.terminal,
      declaredTotal: manifest.pagination.declaredTotal,
      accepted: listings.length,
      rejected: rejected.length,
      nationallyComplete: false as const,
    },
  };
}

function currentFeedPermission(listing: Listing, now: number) {
  const evidence = listing.fieldEvidence["feed.authorizationExpiresAt"];
  if (!evidence) return false; // Legacy feed permission needs an explicit current manifest.
  if (evidence.value === null) return true;
  return (
    typeof evidence.value === "string" &&
    Number.isFinite(Date.parse(evidence.value)) &&
    Date.parse(evidence.value) > now
  );
}
export function feedAllowsPublicExport(listing: Listing, now = Date.now()) {
  return (
    !listing.fieldEvidence["feed.authorization"] ||
    (currentFeedPermission(listing, now) &&
      listing.fieldEvidence["feed.publicRedistribution"]?.value === true)
  );
}
export function feedAllowsPublicImages(listing: Listing, now = Date.now()) {
  return (
    !listing.fieldEvidence["feed.authorization"] ||
    (currentFeedPermission(listing, now) &&
      listing.fieldEvidence["feed.imageRedistribution"]?.value === true)
  );
}
