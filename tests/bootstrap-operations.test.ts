import { describe, expect, it } from "vitest";
import {
  CollectionOperations,
  type OperationsStore,
} from "../server/ingest/operations";
import { bootstrapLegacyOperations } from "../server/ingest/bootstrap-operations";
import { listingSchema } from "../shared/schema";
import type { SourceConfig } from "../server/ingest/adapters";
const now = Date.parse("2026-09-08T18:00:00Z"),
  observed = "2026-09-07T12:00:00.000Z";
const source = (
  id: string,
  extra: Partial<SourceConfig> = {},
): SourceConfig => ({
  id,
  name: id,
  url: "https://example.com",
  category: "fixture",
  status: "partial",
  scope: "configured fixture",
  note: "",
  enabled: true,
  ...extra,
});
const row = (id: string, sourceId = "a", extra: Record<string, unknown> = {}) =>
  listingSchema.parse({
    id,
    sourceListingId: id,
    sourceId,
    sourceName: sourceId,
    url: "https://example.com/" + id,
    title: "1969 Camaro",
    model: "Camaro",
    year: 1969,
    seller: { name: "Fixture dealer", type: "dealer" },
    firstSeenAt: observed,
    lastObservedAt: observed,
    ...extra,
  });
function setup() {
  const data = new Map<string, string>(),
    store: OperationsStore = {
      get: async (key) => data.get(key) || null,
      list: async (prefix) =>
        [...data]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => ({ key, value })),
      cas: async (key, previous, value) => {
        if ((data.get(key) || null) !== previous) return false;
        data.set(key, value);
        return true;
      },
    };
  return { data, ops: new CollectionOperations(store, () => now) };
}
describe("offline legacy operations bootstrap", () => {
  it("creates all retained source queues with actual scopes and original observation dates, without jobs or checkpoints", async () => {
    const { ops } = setup(),
      listings = [
        row("a1"),
        row("a2", "a", {
          scope: "nationwide",
          lastDetailObservedAt: observed,
          parserVersion: "a-detail",
        }),
        row("b1", "b"),
      ];
    const result = await bootstrapLegacyOperations(ops, {
      listings,
      sources: [source("a"), source("b")],
      runs: [],
      now,
    });
    const a = await ops.details("a");
    expect(a.items.a1).toMatchObject({
      status: "pending",
      scopes: ["regional"],
      queryIds: ["legacy-observation"],
      discoveredAt: observed,
    });
    expect(a.items.a2).toMatchObject({
      status: "complete",
      scopes: ["nationwide"],
      completedAt: observed,
    });
    expect((await ops.details("b")).items.b1).toBeTruthy();
    expect(await ops.jobs()).toEqual([]);
    expect((await ops.progress()).catalogs).toEqual([]);
    expect(result).toMatchObject({
      networkRequests: 0,
      jobsCreated: 0,
      catalogCheckpointsCreated: 0,
    });
    expect((await ops.health("a")).lastSuccessAt).toBe(observed);
    expect((await ops.health("a")).lastLiveValidatedAt).toBeUndefined();
  });
  it("imports a concrete403 from failedPages even when the summary error is empty", async () => {
    const { ops } = setup(),
      at = "2026-09-08T02:30:00.000Z";
    await bootstrapLegacyOperations(ops, {
      listings: [row("a1")],
      sources: [source("a")],
      runs: [
        {
          id: "historical-denial",
          sourceId: "a",
          status: "partial",
          scope: "regional",
          startedAt: at,
          finishedAt: at,
          error: null,
          stats: JSON.stringify({
            failedPages: [
              "https://example.com/a1: Source HTTP 403; stopped without bypass.",
            ],
          }),
        },
      ],
      now,
    });
    expect(await ops.health("a")).toMatchObject({
      state: "review",
      lastFailure: { kind: "access", httpStatus: 403, at },
    });
    expect((await ops.details("a")).items.a1.status).toBe("blocked");
    expect(await ops.allowed("a")).toBe(false);
  });
  it("uses the latest completed real run and never revives an old denial after a later success", async () => {
    const { ops } = setup();
    await bootstrapLegacyOperations(ops, {
      listings: [row("a1")],
      sources: [source("a", { note: "Earlier detail403" })],
      runs: [
        {
          sourceId: "a",
          status: "blocked",
          scope: "regional",
          startedAt: "2026-09-07T00:00:00Z",
          error: "Source HTTP 403",
        },
        {
          sourceId: "a",
          status: "complete",
          scope: "regional",
          startedAt: "2026-09-08T00:00:00Z",
          finishedAt: "2026-09-08T00:01:00Z",
          stats: "{}",
        },
        {
          sourceId: "a",
          status: "running",
          scope: "regional",
          startedAt: "2026-09-08T17:00:00Z",
          error: "not a finished observation",
        },
      ],
      now,
    });
    expect((await ops.health("a")).state).toBe("active");
    expect((await ops.health("a")).lastLiveValidatedAt).toBeUndefined();
  });
  it("preserves existing reviewed health and attempted tasks byte-for-byte on repeated bootstrap", async () => {
    const { ops, data } = setup(),
      listings = [row("a1")],
      input = { listings, sources: [source("a")], runs: [], now };
    await bootstrapLegacyOperations(ops, input);
    await ops.reviewSource(
      "a",
      "pause",
      "User paused this source after review.",
    );
    const before = JSON.stringify([...data]);
    const result = await bootstrapLegacyOperations(ops, input);
    expect(JSON.stringify([...data])).toBe(before);
    expect(result.sources[0]).toMatchObject({
      addedDetails: 0,
      healthCreated: false,
      healthState: "review",
    });
  });
  it("does not enable disabled/manual sources or import samples into real operational queues", async () => {
    const { ops } = setup();
    const result = await bootstrapLegacyOperations(ops, {
      listings: [
        row("disabled1", "disabled"),
        row("manual1", "manual"),
        row("fake", "a", { isSample: true }),
      ],
      sources: [
        source("disabled", { enabled: false, status: "restricted" }),
        source("a"),
      ],
      runs: [],
      now,
    });
    expect((await ops.details("disabled")).items.disabled1.status).toBe(
      "blocked",
    );
    expect((await ops.details("manual")).items.manual1.status).toBe("blocked");
    expect((await ops.details("a")).items.fake).toBeUndefined();
    expect(result.skippedSamples).toBe(1);
  });
  it("preserves the historical Retry-After deadline and ignores malformed stats safely", async () => {
    const { ops } = setup();
    await bootstrapLegacyOperations(ops, {
      listings: [row("a1"), row("b1", "b")],
      sources: [source("a"), source("b")],
      runs: [
        {
          sourceId: "a",
          status: "partial",
          scope: "regional",
          startedAt: "2026-09-08T17:55:00Z",
          error: "Source HTTP429",
          stats: {
            failedPages: ["Source HTTP 429"],
            accessHealth: {
              lastFailure: {
                message: "Source HTTP 429",
                retryAfterAt: "2026-09-09T00:00:00Z",
              },
            },
          },
        },
        {
          sourceId: "b",
          status: "complete",
          scope: "regional",
          startedAt: observed,
          stats: "{broken",
        },
      ],
      now,
    });
    expect((await ops.health("a")).nextPermittedAt).toBe(
      "2026-09-09T00:00:00.000Z",
    );
    expect((await ops.health("b")).state).toBe("active");
  });
  it("does not mistake a healthy run's retained lastFailure for a new denial", async () => {
    const { ops } = setup();
    await bootstrapLegacyOperations(ops, {
      listings: [row("a1")],
      sources: [source("a")],
      runs: [
        {
          sourceId: "a",
          scope: "regional",
          status: "complete",
          startedAt: observed,
          error: "Source HTTP 403",
          stats: {
            failedPages: [],
            failedInventoryPages: 0,
            failedDetails: 0,
            accessHealth: {
              state: "active",
              lastFailure: {
                message: "Source HTTP 403",
                at: "2026-09-06T00:00:00Z",
              },
            },
          },
        },
      ],
      now,
    });
    expect((await ops.health("a")).state).toBe("active");
    expect((await ops.health("a")).lastFailure).toBeUndefined();
  });
  it("refuses future detail timestamps as evidence of completed enrichment", async () => {
    const { ops } = setup();
    await bootstrapLegacyOperations(ops, {
      listings: [
        row("a1", "a", {
          lastDetailObservedAt: "2027-01-01T00:00:00Z",
          parserVersion: "a-detail",
        }),
      ],
      sources: [source("a")],
      runs: [],
      now,
    });
    expect((await ops.details("a")).items.a1.status).toBe("pending");
  });
});
