import type { FeedManifest } from "./authorized-feed";
import { parseAuthorizedFeed } from "./authorized-feed";
import { safeRequest } from "../safe-fetch";

type BrowseItem = {
  itemId: string;
  title: string;
  itemWebUrl: string;
  categories?: { categoryId: string; categoryName?: string }[];
  buyingOptions?: string[];
  price?: { value: string; currency: string };
  currentBidPrice?: { value: string; currency: string };
  itemCreationDate?: string;
  itemEndDate?: string;
  seller?: { username?: string };
  itemLocation?: {
    city?: string;
    stateOrProvince?: string;
    postalCode?: string;
    country?: string;
  };
  image?: { imageUrl: string };
  additionalImages?: { imageUrl: string }[];
};
export type EbayQuery = {
  query: string;
  leafCategoryIds: string[];
  offset?: number;
  limit?: number;
  buyingOptions?: (
    "AUCTION" | "FIXED_PRICE" | "BEST_OFFER" | "CLASSIFIED_AD"
  )[];
};
const endpoint = "https://api.ebay.com/buy/browse/v1/item_summary/search";
export function ebayBrowseUrl(query: EbayQuery) {
  if (!query.query.trim() || query.query.length > 200)
    throw new Error("A bounded model/specialty query is required");
  if (
    !query.leafCategoryIds.length ||
    query.leafCategoryIds.some((id) => !/^\d+$/.test(id))
  )
    throw new Error(
      "Configure whole-vehicle leaf categories verified with eBay Taxonomy",
    );
  const limit = query.limit ?? 50,
    offset = query.offset ?? 0;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 200 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset + limit > 10000
  )
    throw new Error(
      "Browse page range is invalid or exceeds 10,000 results; partition the explicit query scope",
    );
  const url = new URL(endpoint);
  url.searchParams.set("q", query.query);
  url.searchParams.set("category_ids", query.leafCategoryIds.join(","));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));
  url.searchParams.set(
    "filter",
    `itemLocationCountry:US,buyingOptions:{${(query.buyingOptions || ["AUCTION", "FIXED_PRICE", "BEST_OFFER", "CLASSIFIED_AD"]).join("|")}}`,
  );
  return url.href;
}
export function validatedEbayNext(next: string | undefined, current: string) {
  if (!next) return null;
  const a = new URL(current),
    b = new URL(next);
  if (
    b.origin !== new URL(endpoint).origin ||
    b.pathname !== new URL(endpoint).pathname ||
    b.username ||
    b.password ||
    b.port
  )
    throw new Error("Unexpected eBay pagination target");
  for (const field of ["q", "category_ids", "filter", "limit"])
    if (a.searchParams.get(field) !== b.searchParams.get(field))
      throw new Error("eBay pagination changed the configured query scope");
  const oldOffset = Number(a.searchParams.get("offset") || 0),
    newOffset = Number(b.searchParams.get("offset"));
  if (
    !Number.isInteger(newOffset) ||
    newOffset <= oldOffset ||
    newOffset + Number(b.searchParams.get("limit")) > 10000
  )
    throw new Error("Non-progressing or capped eBay pagination");
  return b.href;
}
function amount(
  value: { value: string; currency: string } | undefined,
  currency: string,
) {
  if (!value) return null;
  if (value.currency !== currency || !/^\d+(\.\d+)?$/.test(value.value))
    throw new Error("eBay money value/currency is inconsistent");
  return Number(value.value);
}
export function parseEbayBrowsePage(
  payload: { itemSummaries?: BrowseItem[]; total?: number; next?: string },
  manifest: FeedManifest,
  query: EbayQuery,
  observedAt: string,
) {
  if (!Array.isArray(payload.itemSummaries) && payload.total !== 0)
    throw new Error("Missing eBay item summaries; not a verified empty result");
  const rejected: { index: number; reason: string }[] = [],
    rows = [];
  for (const [index, item] of (payload.itemSummaries || []).entries()) {
    try {
      if (
        !item.categories?.some((c) =>
          query.leafCategoryIds.includes(c.categoryId),
        )
      )
        throw new Error("Item lacks a verified whole-vehicle leaf category");
      // Category evidence plus exclusion prevents common miscategorized accessories entering car inventory.
      if (
        /\b(for parts|parts only|diecast|die-cast|scale model|1:18|1:24|1:64|brochure|poster|wheel set|engine only)\b/i.test(
          item.title,
        )
      )
        throw new Error("Item appears to be parts, memorabilia or a model");
      const auction = item.buyingOptions?.includes("AUCTION"),
        fixed = item.buyingOptions?.includes("FIXED_PRICE"),
        offer = item.buyingOptions?.includes("BEST_OFFER");
      const currency =
        item.currentBidPrice?.currency || item.price?.currency || "USD";
      const price = amount(item.price, currency),
        bid = amount(item.currentBidPrice, currency);
      if (!auction && bid !== null)
        throw new Error("Bid appears without auction buying option");
      const u = new URL(item.itemWebUrl);
      if (!/(^|\.)ebay\.com$/.test(u.hostname))
        throw new Error("Unexpected eBay listing URL");
      const at = Date.parse(observedAt),
        end = item.itemEndDate && Date.parse(item.itemEndDate),
        start = item.itemCreationDate && Date.parse(item.itemCreationDate);
      const availability = auction
        ? end && end <= at
          ? "auction-ended"
          : start && start > at
            ? "upcoming-auction"
            : end && start && start <= at
              ? "live-auction"
              : "unknown"
        : "active";
      const loc = item.itemLocation;
      rows.push({
        sourceListingId: item.itemId,
        url: item.itemWebUrl,
        title: item.title,
        observedAt,
        wholeVehicle: true,
        seller: {
          name: item.seller?.username || "eBay seller",
          type: "unknown",
        },
        vehicleLocation:
          loc?.country === "US" && loc.city && loc.stateOrProvince
            ? {
                city: loc.city,
                state: loc.stateOrProvince,
                postalCode: loc.postalCode,
                country: "US",
                precision: "city",
              }
            : null,
        saleType: auction
          ? "auction"
          : offer
            ? "negotiable"
            : fixed || item.buyingOptions?.includes("CLASSIFIED_AD")
              ? "fixed"
              : "unknown",
        availability,
        askingPrice: auction ? null : price,
        currentBid: bid,
        buyItNow: fixed ? price : null,
        currency,
        auctionStart: auction ? item.itemCreationDate || null : null,
        auctionEnd: auction ? item.itemEndDate || null : null,
        auctionTimezone: auction && item.itemEndDate ? "UTC" : null,
        photos: [
          item.image?.imageUrl,
          ...(item.additionalImages || []).map((i) => i.imageUrl),
        ].filter(Boolean),
      });
    } catch (error) {
      rejected.push({ index, reason: (error as Error).message });
    }
  }
  const next = validatedEbayNext(payload.next, ebayBrowseUrl(query));
  const parsed = parseAuthorizedFeed(
    {
      manifest: {
        ...manifest,
        generatedAt: observedAt,
        pagination: {
          cursor: String(query.offset || 0),
          nextCursor: next,
          terminal: !next,
          declaredTotal: payload.total ?? null,
        },
      },
      listings: rows,
    },
    new Date(observedAt),
  );
  return { ...parsed, rejected: [...rejected, ...parsed.rejected], next };
}

// One explicitly requested API page; caller owns persisted job/checkpoint and shared budget.
// Tokens never enter URLs, source evidence, return values, logs or a public snapshot.
export async function fetchEbayBrowsePage(
  manifest: FeedManifest,
  query: EbayQuery,
  options: {
    token: string;
    approvalReference: string;
    taxonomyReviewedAt: string;
    request?: typeof safeRequest;
  },
) {
  if (!options.token.trim() || !options.approvalReference.trim())
    throw new Error(
      "Approved eBay production access and a user-supplied application token are required",
    );
  if (
    manifest.authorization.basis !== "provider-license" ||
    manifest.authorization.reference !== options.approvalReference
  )
    throw new Error(
      "eBay manifest must identify the approved provider agreement",
    );
  if (
    !Number.isFinite(Date.parse(options.taxonomyReviewedAt)) ||
    Date.parse(options.taxonomyReviewedAt) > Date.now()
  )
    throw new Error(
      "Date the whole-vehicle leaf-category review before requesting eBay inventory",
    );
  parseAuthorizedFeed({ manifest, listings: [] }); // validates authorization expiry before network work
  const response = await (options.request || safeRequest)(
    ebayBrowseUrl(query),
    {
      origins: ["https://api.ebay.com"],
      maxBytes: 2e6,
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: "application/json",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      },
    },
  );
  if (response.status !== 200) {
    const kind =
      response.status === 401
        ? "credentials"
        : response.status === 403
          ? "access"
          : response.status === 429
            ? "quota"
            : response.status >= 500
              ? "service"
              : "request";
    throw new Error(
      `eBay ${kind} error HTTP ${response.status}; no retry or credential workaround was attempted`,
    );
  }
  return parseEbayBrowsePage(
    JSON.parse(response.body),
    manifest,
    query,
    new Date().toISOString(),
  );
}
