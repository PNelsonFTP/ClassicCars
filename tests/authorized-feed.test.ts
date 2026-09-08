import { describe, it, expect } from "vitest";
import {
  parseAuthorizedFeed,
  feedAllowsPublicExport,
  feedManifestSchema,
} from "../server/ingest/authorized-feed";
import {
  ebayBrowseUrl,
  parseEbayBrowsePage,
  validatedEbayNext,
  fetchEbayBrowsePage,
} from "../server/ingest/ebay-browse";
const observed = "2026-09-08T12:00:00Z";
const manifest = () =>
  feedManifestSchema.parse({
    schemaVersion: 1,
    feedId: "test-feed",
    sourceId: "ebay",
    sourceName: "Authorized fixture provider",
    generatedAt: observed,
    scope: "nationwide",
    query: "1993 Ford Mustang Cobra",
    authorization: {
      basis: "provider-license",
      reference: "fixture permission",
      reviewedAt: observed,
    },
    allowedListingHosts: ["www.ebay.com"],
    allowedImageHosts: ["i.ebayimg.com"],
    pagination: { cursor: null, nextCursor: null, terminal: true },
  });
const row = () => ({
  sourceListingId: "fixture-1",
  url: "https://www.ebay.com/itm/fixture-1",
  wholeVehicle: true,
  title: "1993 Ford Mustang Cobra",
  observedAt: observed,
  seller: { name: "Fixture seller" },
  saleType: "fixed",
  availability: "active",
  askingPrice: 25000,
});
const parse = (r: unknown, m = manifest()) =>
  parseAuthorizedFeed({ manifest: m, listings: [r] }, new Date(observed));
const query = {
  query: "1967 Ford Mustang",
  leafCategoryIds: ["12345"],
  limit: 50,
};
const ebay = () => ({
  itemId: "v1|fixture|0",
  title: "1967 Ford Mustang",
  itemWebUrl: "https://www.ebay.com/itm/fixture",
  categories: [{ categoryId: "12345" }],
  buyingOptions: ["AUCTION", "FIXED_PRICE"],
  price: { value: "25000.00", currency: "USD" },
  currentBidPrice: { value: "15000.00", currency: "USD" },
  itemCreationDate: "2026-09-01T10:00:00Z",
  itemEndDate: "2026-09-10T10:00:00Z",
});
describe("authorized feed contracts", () => {
  it("keeps observations, identities and private publication policy explicit", () => {
    const result = parse(row());
    expect(result.rejected).toEqual([]);
    const l = result.listings[0];
    expect(l.year).toBe(1993);
    expect(l.firstSeenAt).toBe(observed);
    expect(l.lastNetworkCheckedAt).toBeNull();
    expect(feedAllowsPublicExport(l)).toBe(false);
    expect(result.coverage.nationallyComplete).toBe(false);
  });
  it("rejects expired permission before accepting rows", () => {
    const m = manifest();
    m.authorization.expiresAt = observed;
    expect(() => parse(row(), m)).toThrow("expired");
  });
  it("rejects future timestamps, mixed auction asks and non-car rows", () => {
    expect(
      parse({ ...row(), observedAt: "2027-01-01T00:00:00Z" }).rejected,
    ).toHaveLength(1);
    expect(parse({ ...row(), saleType: "auction" }).rejected).toHaveLength(1);
    expect(parse({ ...row(), wholeVehicle: false }).rejected).toHaveLength(1);
  });
  it("requires a document for supported specialty claims", () => {
    expect(
      parse({
        ...row(),
        specialty: "SVT/Cobra",
        specialtyEvidence: "document-supported",
      }).rejected,
    ).toHaveLength(1);
    expect(
      parse({
        ...row(),
        specialty: "SVT/Cobra",
        specialtyEvidence: "document-supported",
        specialtyEvidenceReference: "https://www.ebay.com/document/fixture",
      }).listings[0].specialtyEvidence,
    ).toBe("document-supported");
  });
  it("does not turn unknown phase into a live auction", () => {
    expect(
      parse({
        ...row(),
        saleType: "auction",
        askingPrice: null,
        availability: "unknown",
        currentBid: 5000,
        auctionEnd: "2026-09-10T12:00:00Z",
      }).listings[0].availability,
    ).toBe("unknown");
  });
  it("retains reserve, fees and ended outcome separately", () => {
    const l = parse({
      ...row(),
      saleType: "auction",
      askingPrice: null,
      availability: "live-auction",
      auctionEnd: "2026-09-07T12:00:00-05:00",
      reserveStatus: "not-met",
      auctionOutcome: "not-sold",
      currentBid: 18000,
      buyItNow: 30000,
      disclosedFees: 150,
      buyerPremium: "5 percent; minimum 250",
    }).listings[0];
    expect(l.availability).toBe("auction-ended");
    expect(l.auctionOutcome).toBe("not-sold");
    expect(l.disclosedFees).toBe(150);
  });
  it("rejects foreign URL/image hosts and duplicate page IDs", () => {
    expect(
      parse({ ...row(), url: "https://attacker.invalid/x" }).rejected,
    ).toHaveLength(1);
    expect(
      parse({ ...row(), photos: ["https://attacker.invalid/x.jpg"] }).rejected,
    ).toHaveLength(1);
    expect(
      parseAuthorizedFeed(
        { manifest: manifest(), listings: [row(), row()] },
        new Date(observed),
      ).rejected,
    ).toHaveLength(1);
  });
});
describe("eBay Browse adapter contract", () => {
  it("uses verified leaf categories, US item location and all selected buying options", () => {
    const u = new URL(ebayBrowseUrl(query));
    expect(u.searchParams.get("category_ids")).toBe("12345");
    expect(u.searchParams.get("filter")).toContain("itemLocationCountry:US");
    expect(u.searchParams.get("filter")).toContain(
      "AUCTION|FIXED_PRICE|BEST_OFFER|CLASSIFIED_AD",
    );
    expect(() => ebayBrowseUrl({ ...query, leafCategoryIds: [] })).toThrow(
      "whole-vehicle",
    );
  });
  it("separates bid and buy-now without an asking-price substitution", () => {
    const l = parseEbayBrowsePage(
      { itemSummaries: [ebay()], total: 1 },
      manifest(),
      query,
      observed,
    ).listings[0];
    expect(l.askingPrice).toBeNull();
    expect(l.currentBid).toBe(15000);
    expect(l.buyItNow).toBe(25000);
    expect(l.availability).toBe("live-auction");
    expect(l.reserveStatus).toBe("unknown");
  });
  it("rejects unrelated categories and inconsistent money", () => {
    expect(
      parseEbayBrowsePage(
        { itemSummaries: [{ ...ebay(), categories: [{ categoryId: "999" }] }] },
        manifest(),
        query,
        observed,
      ).rejected,
    ).toHaveLength(1);
    expect(
      parseEbayBrowsePage(
        {
          itemSummaries: [
            { ...ebay(), currentBidPrice: { value: "20", currency: "EUR" } },
          ],
        },
        manifest(),
        query,
        observed,
      ).rejected,
    ).toHaveLength(1);
  });
  it("rejects parts and avoids claiming zero inventory for a missing body", () => {
    expect(
      parseEbayBrowsePage(
        { itemSummaries: [{ ...ebay(), title: "1967 Mustang diecast 1:18" }] },
        manifest(),
        query,
        observed,
      ).rejected,
    ).toHaveLength(1);
    expect(() => parseEbayBrowsePage({}, manifest(), query, observed)).toThrow(
      "not a verified empty",
    );
  });
  it("requires advancing same-scope pagination and limits the result window", () => {
    const current = ebayBrowseUrl(query),
      next = ebayBrowseUrl({ ...query, offset: 50 });
    expect(validatedEbayNext(next, current)).toBe(next);
    expect(() => validatedEbayNext(current, current)).toThrow(
      "Non-progressing",
    );
    expect(() =>
      validatedEbayNext(
        next.replace("api.ebay.com", "attacker.invalid"),
        current,
      ),
    ).toThrow("Unexpected");
    expect(() => ebayBrowseUrl({ ...query, offset: 9990 })).toThrow("10,000");
  });
  it("will not make a network request without credentials and permission", async () => {
    let called = false;
    await expect(
      fetchEbayBrowsePage(manifest(), query, {
        token: "",
        approvalReference: "",
        taxonomyReviewedAt: observed,
        request: async () => {
          called = true;
          return { status: 200, body: "{}", headers: {} };
        },
      }),
    ).rejects.toThrow("production access");
    expect(called).toBe(false);
  });
});
