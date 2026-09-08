import { describe, expect, it } from "vitest";
import { listingSchema } from "../shared/schema";
import {
  evaluateAlertPolicy,
  parseAlertBaseline,
} from "../shared/alert-policy";
import {
  deliveryBatchId,
  deliveryFailure,
  smtpTransportOptions,
  SMTP_TIMEOUTS,
} from "../server/delivery-policy";
const stamp = "2026-09-08T00:00:00Z",
  now = new Date(stamp);
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
    saleType: "fixed",
    availability: "active",
    ...extra,
  });
describe("vehicle versus ad alert semantics", () => {
  it("keeps first and legacy baselines quiet", () => {
    const a = car("a");
    expect(
      evaluateAlertPolicy({
        allListings: [a],
        matchingAds: [a],
        previous: null,
        now,
      }).changes,
    ).toEqual([]);
    expect(parseAlertBaseline(JSON.stringify({ a: { ask: 100 } }))).toBeNull();
  });
  it("suppresses new-car notifications for crosspost arrival and reports its new source only when opted in", () => {
    const a = car("a"),
      base = evaluateAlertPolicy({
        allListings: [a],
        matchingAds: [a],
        previous: null,
        now,
      }).baseline;
    const groupedA = { ...a, groupId: "vehicle:g" },
      b = car("b", { groupId: "vehicle:g", askingPrice: 45000 });
    const input = {
      allListings: [groupedA, b],
      matchingAds: [b, groupedA],
      previous: base,
      now,
    };
    expect(evaluateAlertPolicy(input).changes).toEqual([]);
    expect(
      evaluateAlertPolicy({ ...input, crosspostAlerts: true }).changes.map(
        (e) => e.kind,
      ),
    ).toEqual(["source-added"]);
  });
  it("allows explicit ad-level new matches without comparing crosspost asks", () => {
    const a = car("a", { groupId: "g" }),
      b = car("b", { groupId: "g", askingPrice: 30000 });
    const previous = evaluateAlertPolicy({
      allListings: [a],
      matchingAds: [a],
      previous: null,
      policy: "ad",
      now,
    }).baseline;
    expect(
      evaluateAlertPolicy({
        allListings: [a, b],
        matchingAds: [b, a],
        previous,
        policy: "ad",
        now,
      }).changes.map((c) => c.kind),
    ).toEqual(["new-match"]);
  });
  it("is invariant to representatives, sort order, merge and unmerge transitions", () => {
    const a = car("a"),
      b = car("b");
    const previous = evaluateAlertPolicy({
      allListings: [a, b],
      matchingAds: [a, b],
      previous: null,
      now,
    }).baseline;
    const grouped = [a, b].map((l) => ({ ...l, groupId: "reviewed:group" }));
    const merged = evaluateAlertPolicy({
      allListings: grouped,
      matchingAds: [...grouped].reverse(),
      previous,
      now,
    });
    expect(merged.changes).toEqual([]);
    expect(
      evaluateAlertPolicy({
        allListings: [b, a],
        matchingAds: [b, a],
        previous: merged.baseline,
        now,
      }).changes,
    ).toEqual([]);
  });
  it("reports one new vehicle when two already-grouped ads arrive in one evaluation", () => {
    const previous = evaluateAlertPolicy({
      allListings: [],
      matchingAds: [],
      previous: null,
      now,
    }).baseline;
    const ads = [car("b", { groupId: "g" }), car("a", { groupId: "g" })];
    expect(
      evaluateAlertPolicy({
        allListings: ads,
        matchingAds: ads,
        previous,
        now,
      }).changes.map((c) => c.listing.id),
    ).toEqual(["a"]);
  });
  it("does not suppress a new match using a previously matched ad's detached group", () => {
    const a = car("a", { groupId: "old-group" }),
      b = car("b", { groupId: "old-group" });
    const previous = evaluateAlertPolicy({
      allListings: [a, b],
      matchingAds: [a],
      previous: null,
      now,
    }).baseline;
    const detached = { ...a, groupId: null };
    const result = evaluateAlertPolicy({
      allListings: [detached, b],
      matchingAds: [detached, b],
      previous,
      now,
    });
    expect(
      result.changes.map((change) => [change.kind, change.listing.id]),
    ).toEqual([["new-match", "b"]]);
    expect(
      evaluateAlertPolicy({
        allListings: [detached, b],
        matchingAds: [detached, b],
        previous: result.baseline,
        now,
      }).changes,
    ).toEqual([]);
  });
  it("keeps price and availability transitions on their actual source ad", () => {
    const a = car("a", { groupId: "g" }),
      b = car("b", { groupId: "g", askingPrice: 45000 });
    const previous = evaluateAlertPolicy({
      allListings: [a, b],
      matchingAds: [a, b],
      previous: null,
      now,
    }).baseline;
    const updated = {
        ...b,
        askingPrice: 42000,
        lastObservedAt: "2026-09-08T01:00:00Z",
      },
      sold = { ...a, availability: "sold" as const };
    const result = evaluateAlertPolicy({
      allListings: [sold, updated],
      matchingAds: [updated],
      previous,
      now,
    });
    expect(result.changes.map((c) => [c.kind, c.listing.id])).toEqual([
      ["asking-price", "b"],
      ["availability", "a"],
    ]);
    expect(
      evaluateAlertPolicy({
        allListings: [sold, updated],
        matchingAds: [updated],
        previous: result.baseline,
        now,
      }).changes,
    ).toEqual([]);
  });
  it("baselines quietly after an alert-policy change", () => {
    const a = car("a"),
      previous = evaluateAlertPolicy({
        allListings: [a],
        matchingAds: [a],
        previous: null,
        now,
      }).baseline;
    expect(
      evaluateAlertPolicy({
        allListings: [a, car("b")],
        matchingAds: [a, car("b")],
        previous,
        policy: "ad",
        now,
      }).changes,
    ).toEqual([]);
  });
});
describe("bounded and reviewable external delivery", () => {
  it("uses stable order-independent digest IDs and keeps channels separate", () => {
    expect(deliveryBatchId("email", ["a", "b"])).toBe(
      deliveryBatchId("email", ["b", "a"]),
    );
    expect(deliveryBatchId("email", ["a"])).not.toBe(
      deliveryBatchId("webhook", ["a"]),
    );
  });
  it("bounds SMTP even if the configured URL contains timeout overrides", () => {
    const options = smtpTransportOptions(
      "smtps://fixture:secret@example.com:465?socketTimeout=900000",
    );
    expect(options).toMatchObject({
      ...SMTP_TIMEOUTS,
      secure: true,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    expect(smtpTransportOptions("smtp://example.com").requireTLS).toBe(true);
    expect(() => smtpTransportOptions("https://example.com")).toThrow();
  });
  it("separates uncertain sends, permanent rejects, temporary errors and exhausted retries", () => {
    expect(
      deliveryFailure(
        { code: "ETIMEDOUT", message: "secret@example.com password" },
        1,
        0,
      ).status,
    ).toBe("uncertain");
    expect(
      deliveryFailure({ message: "Source request timed out." }, 1, 0).status,
    ).toBe("uncertain");
    expect(deliveryFailure({ responseCode: 450 }, 1, 0).status).toBe("retry");
    expect(deliveryFailure({ responseCode: 550 }, 1, 0).status).toBe("failed");
    expect(deliveryFailure({ statusCode: 429 }, 1, 0).status).toBe("retry");
    expect(deliveryFailure({ statusCode: 401 }, 1, 0).status).toBe("failed");
    expect(deliveryFailure({ statusCode: 503 }, 6, 0).status).toBe("failed");
    expect(
      deliveryFailure(
        { code: "ETIMEDOUT", message: "secret@example.com password" },
        1,
        0,
      ).error,
    ).not.toContain("secret");
  });
});
