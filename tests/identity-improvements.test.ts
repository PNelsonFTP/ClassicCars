import { describe, expect, it } from "vitest";
import labels from "./fixtures/identity-labels.json";
import { listingSchema, type Listing } from "../shared/schema";
import {
  canonicalSeller,
  explainDuplicate,
  mayAutoGroup,
  normalizeStock,
  rankDuplicateCandidates,
  type SellerAlias,
} from "../shared/duplicates";
const stamp = "2026-09-08T00:00:00Z";
const car = (id: string, extra: Record<string, unknown> = {}) =>
  listingSchema.parse({
    id,
    sourceListingId: id,
    sourceId: id,
    sourceName: "Fixture " + id,
    url: "https://example.com/" + id,
    title: "1969 Chevrolet Camaro",
    year: 1969,
    model: "Camaro",
    seller: { name: "Fixture Gallery", type: "dealer" },
    firstSeenAt: stamp,
    lastObservedAt: stamp,
    askingPrice: 39900,
    ...extra,
  });
const aliases: SellerAlias[] = [
  {
    alias: "Gallery Motors Chicago",
    canonical: "Gallery Motors",
    reason: "Synthetic reviewed branch identity",
    reviewedAt: stamp,
  },
];
describe("evidence-ranked identity reconciliation", () => {
  for (const pair of labels.pairs)
    it(pair.name, () => {
      const a = car("a", pair.left),
        b = car("b", pair.right),
        result = rankDuplicateCandidates([a, b], { aliases });
      expect(result.total > 0).toBe(pair.candidate);
      if (pair.candidate) {
        expect(result.rows[0].confidence === "strong-evidence").toBe(
          pair.strong,
        );
        if ("conflict" in pair && pair.conflict) {
          expect(result.rows[0].confidence).toBe("conflicting");
          expect(mayAutoGroup(a, b)).toBe(false);
        }
        expect(result.rows[0].ads.map((ad) => ad.url)).toEqual([a.url, b.url]);
        expect(result.rows[0].ads.map((ad) => ad.ask)).toEqual([39900, 39900]);
      }
    });
  it("reports labeled candidate precision/recall separately from strong evidence precision", () => {
    const rows = labels.pairs.map((p) => ({
      ...p,
      found: rankDuplicateCandidates([car("a", p.left), car("b", p.right)], {
        aliases,
      }).rows[0],
    }));
    const truePositives = rows.filter((r) => r.sameCar && r.found).length,
      found = rows.filter((r) => r.found).length,
      positives = rows.filter((r) => r.sameCar).length;
    expect({
      candidatePrecision: truePositives / found,
      candidateRecall: truePositives / positives,
    }).toEqual({ candidatePrecision: 0.75, candidateRecall: 1 });
    const strong = rows.filter(
      (r) => r.found?.confidence === "strong-evidence",
    );
    expect(strong.filter((r) => r.sameCar).length / strong.length).toBe(1);
    expect(strong.length).toBe(4);
  });
  it("retains raw stock and requires explicit direct seller aliases", () => {
    expect(normalizeStock("Stock # 001-25")).toBe("00125");
    expect(normalizeStock("001/25")).toBe("001/25");
    expect(normalizeStock("00000")).toBeNull();
    expect(canonicalSeller("Gallery Motors Chicago")).not.toBe(
      canonicalSeller("Gallery Motors"),
    );
    expect(canonicalSeller("Gallery Motors Chicago", aliases)).toBe(
      canonicalSeller("Gallery Motors"),
    );
  });
  it("paginates every indexed candidate deterministically and honors dismiss/undo", () => {
    const listings = Array.from({ length: 8 }, (_, i) =>
      car(`ad-${i}`, { identifier: "12345678" }),
    );
    const ids: string[] = [];
    let offset: number | null = 0;
    while (offset != null) {
      const page = rankDuplicateCandidates(listings, { offset, limit: 5 });
      ids.push(...page.rows.map((r) => r.id));
      offset = page.nextOffset;
    }
    expect(ids).toHaveLength(28);
    expect(new Set(ids).size).toBe(28);
    const first = rankDuplicateCandidates(listings).rows[0];
    const decision = {
      pairId: first.id,
      ids: first.ids,
      action: "dismissed" as const,
      reason: "Different cars after reviewed evidence",
      reviewedAt: stamp,
    };
    expect(
      rankDuplicateCandidates(listings, { decisions: [decision] }).total,
    ).toBe(27);
    expect(
      rankDuplicateCandidates(listings, {
        decisions: [decision],
        includeDismissed: true,
      }).rows.find((r) => r.id === first.id)?.dismissed,
    ).toBe(true);
    expect(
      rankDuplicateCandidates(listings, {
        decisions: [{ ...decision, action: "restored" }],
      }).total,
    ).toBe(28);
  });
  it("indexes 25,000 generic listings without quadratic title-only comparisons", () => {
    const listings = Array.from({ length: 25000 }, (_, i) => car(`scale-${i}`));
    const start = performance.now(),
      result = rankDuplicateCandidates(listings);
    expect(result.total).toBe(0);
    expect(result.diagnostics.comparedPairs).toBe(0);
    expect(performance.now() - start).toBeLessThan(3000);
  });
  it("does not turn matching stock with a partial identifier conflict into an automatic merge", () => {
    const a = car("a", { stockNumber: "7", identifier: "12345678" }),
      b = car("b", { stockNumber: "7", identifier: "99999999" });
    expect(mayAutoGroup(a, b)).toBe(false);
    expect(explainDuplicate(a, b).conflicts[0].field).toBe("identifier");
  });
  it("does not auto-attach an incoming ad into an explicitly reviewed group", () => {
    expect(
      mayAutoGroup(car("a"), car("b", { groupId: "reviewed:existing" })),
    ).toBe(false);
  });
});
