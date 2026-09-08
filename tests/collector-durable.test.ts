import { beforeEach, describe, expect, it, vi } from "vitest";
import { listingSchema, settingsSchema, type Listing } from "../shared/schema";
const memory = vi.hoisted(() => ({
  state: new Map<string, string>(),
  listings: new Map<string, unknown>(),
  pages: new Map<string, { ids: string[]; next: string[] }>(),
  calls: [] as string[],
  cacheHours: [] as number[],
  fails: new Map<string, Error>(),
  runs: [] as Record<string, unknown>[],
  sources: [
    {
      id: "fixture",
      enabled: true,
      url: "https://example.com",
      origins: ["https://example.com"],
      inventory: ["https://example.com/mustang", "https://example.com/camaro"],
    },
  ],
}));
vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:fs/promises")>()),
  readFile: async (path: string) => {
    if (path === "config/sources.json") return JSON.stringify(memory.sources);
    throw Error("Unexpected filesystem read in fixture.");
  },
}));
vi.mock("../server/db", () => ({
  db: {
    ingestRun: {
      updateMany: async () => ({ count: 0 }),
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const run = { ...data, id: String(memory.runs.length) };
        memory.runs.push(run);
        return run;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        Object.assign(memory.runs[Number(where.id)], data);
      },
    },
  },
}));
vi.mock("../server/ingest/state", async () => {
  const { CollectionOperations } = await import("../server/ingest/operations");
  return {
    operations: new CollectionOperations({
      get: async (k) => memory.state.get(k) || null,
      list: async (prefix) =>
        [...memory.state]
          .filter(([k]) => k.startsWith(prefix))
          .map(([key, value]) => ({ key, value })),
      cas: async (key, before, value) => {
        if ((memory.state.get(key) || null) !== before) return false;
        memory.state.set(key, value);
        return true;
      },
    }),
  };
});
vi.mock("../server/store", () => ({
  acquireLease: async () => ({
    renew: async () => {},
    release: async () => {},
  }),
  getSettings: async () => settingsSchema.parse({}),
  allListings: async () => [...memory.listings.values()],
  upsertListing: async (l: Listing) => {
    memory.listings.set(l.id, structuredClone(l));
    return l;
  },
  exportSnapshot: async () => ({}),
}));
vi.mock("../server/service-budget", () => ({
  reserveServiceRequest: async () => {},
}));
vi.mock("../server/safe-fetch", () => ({
  cachedPage: async (url: string, options: { cacheHours: number }) => {
    memory.calls.push(url);
    memory.cacheHours.push(options.cacheHours);
    if (memory.fails.has(url)) throw memory.fails.get(url);
    return {
      html: url,
      url,
      observedAt: new Date().toISOString(),
      lastNetworkCheckedAt: new Date().toISOString(),
      hash: "fixture",
      cacheHit: false,
    };
  },
}));
vi.mock("../server/ingest/adapters", () => ({
  parseInventory: (html: string) => {
    const p = memory.pages.get(html);
    if (!p) throw Error("Unknown fixture page");
    return {
      listings: p.ids.map((id) =>
        listingSchema.parse({
          id,
          sourceId: "fixture",
          sourceName: "Fixture dealer",
          sourceListingId: id,
          title: "1969 Camaro",
          model: "Camaro",
          year: 1969,
          url: "https://example.com/car/" + id,
          availability: "active",
          saleType: "fixed",
          seller: { name: "Fixture dealer", type: "dealer" },
          firstSeenAt: new Date().toISOString(),
          lastObservedAt: new Date().toISOString(),
        }),
      ),
      next: p.next,
      discovered: p.ids.length,
    };
  },
  detailUrl: (l: Listing) => l.url,
  parseDetail: (_html: string, l: Listing, page: { observedAt: string }) => ({
    ...l,
    parserVersion: "fixture-detail",
    lastDetailObservedAt: page.observedAt,
  }),
}));
import { collect } from "../server/ingest/collector";
import { operations } from "../server/ingest/state";
import { FetchFailure } from "../server/ingest/failures";
import { collectionCliCaps } from "../scripts/collection-cli-options";
beforeEach(() => {
  memory.state.clear();
  memory.listings.clear();
  memory.pages.clear();
  memory.calls.length = 0;
  memory.cacheHours.length = 0;
  memory.fails.clear();
  memory.runs.length = 0;
  memory.pages.set("https://example.com/mustang", {
    ids: ["m1", "m2", "m3"],
    next: ["https://example.com/mustang?page=2"],
  });
  memory.pages.set("https://example.com/camaro", {
    ids: ["c1", "c2"],
    next: [],
  });
  memory.pages.set("https://example.com/mustang?page=2", {
    ids: ["m4"],
    next: [],
  });
});
describe("collector integration with offline sources", () => {
  it("uses retained page and independent detail queues under repeated 1/1 caps", async () => {
    for (let i = 0; i < 7; i++) {
      await collect("regional", "fixture", { pageCap: 1, detailCap: 1 });
      expect((await operations.health("fixture")).lastFailure).toBeUndefined();
    }
    expect(memory.calls.filter((u) => !u.includes("/car/"))).toEqual([
      "https://example.com/mustang",
      "https://example.com/camaro",
      "https://example.com/mustang?page=2",
    ]);
    expect(memory.calls.filter((u) => u.includes("/car/"))).toHaveLength(6);
    expect(memory.listings.size).toBe(6);
    expect(
      (await operations.progress("fixture")).details[0].counts.pending,
    ).toBe(0);
    expect(
      (await operations.jobs()).some((j) => j.status === "completed"),
    ).toBe(true);
  });
  it("persists a source pause, retains existing stock and avoids later automatic calls", async () => {
    const denied = "https://example.com/mustang";
    memory.fails.set(denied, new FetchFailure("Forbidden", "access", 403));
    await collect("regional", "fixture", { pageCap: 1, detailCap: 1 });
    await collect("regional", "fixture", { pageCap: 1, detailCap: 1 });
    expect(memory.calls).toEqual([denied]);
    expect((await operations.health("fixture")).state).toBe("review");
    expect(
      (await operations.progress("fixture")).catalogs[0].counts.blocked,
    ).toBe(1);
  });
  it("durably cancels before the first network request and never marks a full cycle complete", async () => {
    const result = await collect("regional", "fixture", {
      shouldStop: () => true,
    });
    expect(result.status).toBe("interrupted");
    expect(memory.calls).toEqual([]);
    const job = (await operations.jobs())[0];
    expect(job.status).toBe("interrupted");
    expect(job.finishedAt).toBeUndefined();
  });
});

describe("fresh catalog scan caps", () => {
  it("refreshes a completed catalog without smoke's one-page cap, preserving partial progress", async () => {
    await collect("regional", "fixture", { pageCap: 10, detailCap: 0 });
    memory.calls.length = 0;
    memory.cacheHours.length = 0;
    const result = await collect("regional", "fixture", {
      fresh: true,
      pageCap: 2,
      detailCap: 0,
    });
    expect(memory.calls).toEqual([
      "https://example.com/mustang",
      "https://example.com/camaro",
    ]);
    expect(memory.cacheHours).toEqual([0, 0]);
    expect((await operations.progress("fixture")).catalogs[0].cycle).toBe(2);
    const job = await operations.job(result.jobId!);
    expect(job).toMatchObject({
      fresh: true,
      smoke: false,
      pageCap: 2,
      detailCap: 0,
      status: "partial",
    });
    expect(job!.nextRunAt).not.toBeNull();
    // A later capped invocation advances the existing third page, not the two seeds again.
    memory.calls.length = 0;
    await collect("regional", "fixture", {
      fresh: true,
      pageCap: 2,
      detailCap: 0,
    });
    expect(memory.calls).toEqual(["https://example.com/mustang?page=2"]);
  });
  it("keeps enrichment partial but stops rescheduling when its detail lane is disabled", async () => {
    const result = await collect("regional", "fixture", {
      fresh: true,
      pageCap: 10,
      detailCap: 0,
    });
    expect(result.status).toBe("partial");
    expect(memory.calls).toHaveLength(3);
    expect(memory.calls.every((url) => !url.includes("/car/"))).toBe(true);
    expect(
      (await operations.progress("fixture")).details[0].counts.pending,
    ).toBe(6);
    expect(await operations.job(result.jobId!)).toMatchObject({
      status: "partial",
      nextRunAt: null,
    });
    const idle = await collect("regional", "fixture", {
      pageCap: 0,
      detailCap: 0,
    });
    expect(memory.calls).toHaveLength(3);
    expect(await operations.job(idle.jobId!)).toMatchObject({
      status: "partial",
      nextRunAt: null,
    });
  });
  it("distinguishes zero CLI caps from omitted defaults and rejects malformed caps", () => {
    expect(collectionCliCaps(["--fresh", "--pages=0", "--details=0"])).toEqual({
      fresh: true,
      smoke: false,
      pageCap: 0,
      detailCap: 0,
    });
    expect(collectionCliCaps([])).toEqual({
      fresh: false,
      smoke: false,
      pageCap: undefined,
      detailCap: undefined,
    });
    expect(collectionCliCaps(["--pages=50000"])).toMatchObject({
      pageCap: 50000,
    });
    for (const option of [
      "--pages=-1",
      "--details=",
      "--pages=no",
      "--details=1.5",
    ])
      expect(() => collectionCliCaps([option])).toThrow(
        /nonnegative safe integer/,
      );
  });
});
