import { describe, expect, it } from "vitest";
import {
  CollectionOperations,
  canonicalPage,
  type OperationsStore,
} from "../server/ingest/operations";
import {
  FetchFailure,
  classifyFailure,
  failureFromResponse,
  parseRetryAfter,
} from "../server/ingest/failures";
class MemoryStore implements OperationsStore {
  data = new Map<string, string>();
  async get(k: string) {
    return this.data.get(k) || null;
  }
  async list(prefix: string) {
    return [...this.data]
      .filter(([k]) => k.startsWith(prefix))
      .map(([key, value]) => ({ key, value }));
  }
  async cas(k: string, previous: string | null, value: string) {
    if ((this.data.get(k) || null) !== previous) return false;
    this.data.set(k, value);
    return true;
  }
}
function setup() {
  let now = Date.parse("2026-09-08T12:00:00Z");
  const store = new MemoryStore();
  return {
    store,
    ops: new CollectionOperations(store, () => now),
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
  };
}
describe("durable collection operations", () => {
  it("advances all query pages and independent details across restarted one-page/one-detail runs", async () => {
    const { store, now } = setup(),
      fetched: string[] = [],
      enriched: string[] = [];
    const urls = ["https://example.com/mustang", "https://example.com/camaro"];
    const fixture: Record<string, { ids: string[]; next: string[] }> = {
      [urls[0]]: { ids: ["m1", "m2", "m3"], next: [urls[0] + "?page=2"] },
      [urls[1]]: { ids: ["c1", "c2"], next: [urls[1] + "?page=2"] },
      [urls[0] + "?page=2"]: { ids: ["m4"], next: [] },
      [urls[1] + "?page=2"]: { ids: ["c3"], next: [] },
    };
    for (let run = 0; run < 8; run++) {
      // New service instance represents process restart; nothing lives only in memory.
      const ops = new CollectionOperations(store, now);
      const cp = await ops.checkpoint("dealer", "regional", urls, 86400000);
      const task = (await ops.catalogTasks(cp.id))[0];
      if (task) {
        fetched.push(task.url);
        const page = fixture[task.url];
        await ops.discoverDetails(
          "dealer",
          "regional",
          task.queryId,
          page.ids.map((id) => ({ id, url: `https://example.com/car/${id}` })),
        );
        await ops.completePage(cp.id, task, page.next);
      }
      const detail = (await ops.detailTasks("dealer", "regional", 86400000))[0];
      if (detail) {
        enriched.push(detail.listingId);
        await ops.completeDetail(
          "dealer",
          detail.listingId,
          new Date(now()).toISOString(),
        );
      }
    }
    expect(fetched).toEqual([
      urls[0],
      urls[1],
      urls[0] + "?page=2",
      urls[1] + "?page=2",
    ]);
    expect(enriched.sort()).toEqual(["c1", "c2", "c3", "m1", "m2", "m3", "m4"]);
    const p = await new CollectionOperations(store, now).progress();
    expect(p.catalogs[0].counts).toEqual({
      total: 4,
      complete: 4,
      pending: 0,
      blocked: 0,
    });
    expect(p.details[0].counts).toEqual({
      total: 7,
      complete: 7,
      pending: 0,
      blocked: 0,
    });
  });
  it("separates nationwide, regional and changed query configurations", async () => {
    const { ops } = setup();
    const urls = ["https://example.com/?zip=60187"];
    const a = await ops.checkpoint("a", "regional", urls, 1e6);
    const b = await ops.checkpoint("a", "nationwide", urls, 1e6);
    const c = await ops.checkpoint(
      "a",
      "regional",
      ["https://example.com/?zip=10001"],
      1e6,
    );
    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
    await ops.discoverDetails("a", "regional", "q", [
      { id: "r", url: "https://example.com/r" },
    ]);
    expect(await ops.detailTasks("a", "nationwide", 1e6)).toEqual([]);
  });
  it("does not reset a capped catalog, but refreshes a finished cycle after freshness expires", async () => {
    const { ops, advance } = setup();
    const urls = ["https://example.com/start"];
    let cp = await ops.checkpoint("a", "regional", urls, 1000);
    await ops.completePage(cp.id, cp.tasks[0], ["https://example.com/next"]);
    advance(2000);
    cp = await ops.checkpoint("a", "regional", urls, 1000);
    expect(cp.cycle).toBe(1);
    expect((await ops.catalogTasks(cp.id))[0].url.endsWith("next")).toBe(true);
    await ops.completePage(cp.id, (await ops.catalogTasks(cp.id))[0], []);
    advance(1000);
    cp = await ops.checkpoint("a", "regional", urls, 1000);
    expect(cp.cycle).toBe(2);
    expect(cp.tasks).toHaveLength(1);
  });
  it("canonicalizes page-one loops but preserves distinct queries", () => {
    expect(canonicalPage("https://example.com/?z=1&page=1&a=2#top")).toBe(
      "https://example.com/?a=2&z=1",
    );
    expect(canonicalPage("https://example.com/?page=2")).toContain("page=2");
  });
  it("retains a failed page as blocked rather than declaring catalog completion", async () => {
    const { ops } = setup();
    const cp = await ops.checkpoint(
      "a",
      "regional",
      ["https://example.com/"],
      1000,
    );
    const error = new FetchFailure("Forbidden", "access", 403);
    await ops.failPage(
      cp.id,
      cp.tasks[0],
      error,
      await ops.failure("a", error),
    );
    const p = await ops.progress("a");
    expect(p.catalogs[0].completedAt).toBeNull();
    expect(p.catalogs[0].counts.blocked).toBe(1);
    expect(await ops.allowed("a")).toBe(false);
    expect(await ops.allowed("healthy")).toBe(true);
  });
  it("requires a reviewed fresh smoke parse to clear an access pause", async () => {
    const { ops } = setup();
    await ops.failure("a", new FetchFailure("Forbidden", "access", 403));
    await ops.reviewSource(
      "a",
      "request-smoke",
      "Dealer confirmed the permitted ordinary endpoint.",
    );
    expect(await ops.allowed("a")).toBe(false);
    expect(await ops.allowed("a", true)).toBe(true);
    await ops.success("a", false, true);
    expect((await ops.health("a")).state).toBe("smoke-required");
    await ops.success("a", true, false);
    expect((await ops.health("a")).state).toBe("smoke-required");
    await ops.success("a", true, true);
    expect((await ops.health("a")).state).toBe("active");
    expect((await ops.health("a")).lastLiveValidatedAt).toBeTruthy();
  });
  it("respects Retry-After across restart/review and stops automatic retries after three failures", async () => {
    const { ops, store, now, advance } = setup();
    const until = new Date(now() + 3600000).toISOString();
    await ops.failure(
      "a",
      new FetchFailure("Rate limited", "rate-limit", 429, until),
    );
    expect(
      (await new CollectionOperations(store, now).health("a")).nextPermittedAt,
    ).toBe(until);
    await ops.reviewSource(
      "a",
      "request-smoke",
      "Ordinary access was reviewed.",
    );
    expect(await ops.allowed("a", true)).toBe(false);
    advance(3600000);
    expect(await ops.allowed("a", true)).toBe(true);
    await ops.failure("b", new FetchFailure("Server", "server", 503));
    await ops.failure("b", new FetchFailure("Server", "server", 503));
    await ops.failure("b", new FetchFailure("Server", "server", 503));
    expect((await ops.health("b")).state).toBe("review");
  });
  it("reopens reviewed failed work without erasing its evidence", async () => {
    const { ops } = setup();
    const cp = await ops.checkpoint(
      "a",
      "regional",
      ["https://example.com/"],
      1000,
    );
    const error = new FetchFailure("Forbidden", "access", 403),
      health = await ops.failure("a", error);
    await ops.failPage(cp.id, cp.tasks[0], error, health);
    await ops.discoverDetails("a", "regional", "q", [
      { id: "x", url: "https://example.com/x" },
    ]);
    await ops.failDetail("a", "x", error, health);
    await ops.reopenSourceTasks("a");
    expect((await ops.catalogTasks(cp.id))[0].error?.httpStatus).toBe(403);
    expect((await ops.detailTasks("a", "regional", 1000))[0].attempts).toBe(1);
  });
  it("creates distinct job IDs and retains shutdown work for recovery", async () => {
    const { ops, advance } = setup();
    const a = await ops.enqueue({ scope: "regional" }),
      b = await ops.enqueue({ scope: "regional" });
    expect(a.id).not.toBe(b.id);
    await ops.claim(a.id);
    advance(120001);
    await ops.recoverJobs();
    expect((await ops.job(a.id))?.status).toBe("interrupted");
    expect((await ops.claim(a.id))?.attempts).toBe(2);
    await ops.finish(
      a.id,
      { remaining: 3 },
      "partial",
      new Date(Date.now() + 1000).toISOString(),
    );
    expect((await ops.job(a.id))?.finishedAt).toBeUndefined();
  });
  it("cancellation cannot be overwritten by a simultaneous worker completion", async () => {
    const { ops } = setup();
    const j = await ops.enqueue({ scope: "regional" });
    await ops.claim(j.id);
    await Promise.all([
      ops.cancel(j.id),
      ops.finish(j.id, { ok: true }, "partial", new Date().toISOString()),
    ]);
    const final = await ops.job(j.id);
    expect(final?.status).toBe("cancelled");
    expect(final?.nextRunAt).toBeNull();
  });
  it("only one process can claim a queued job", async () => {
    const { ops } = setup();
    const j = await ops.enqueue({ scope: "regional" });
    const claims = await Promise.all([ops.claim(j.id), ops.claim(j.id)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });
  it("manual retry has an auditable parent and keeps checkpoints intact", async () => {
    const { ops } = setup();
    const j = await ops.enqueue({
      scope: "regional",
      kind: "routes",
      limit: 5,
    });
    await ops.cancel(j.id);
    const next = await ops.retry(j.id);
    expect(next.parentJobId).toBe(j.id);
    expect(next.status).toBe("queued");
    expect(next.kind).toBe("routes");
    expect(next.limit).toBe(5);
    expect((await ops.job(j.id))?.status).toBe("cancelled");
  });
  it("bounded job failures stop automatic recovery after three attempts", async () => {
    const { ops } = setup();
    const j = await ops.enqueue({ scope: "regional" });
    await ops.failJob(j.id, Error("db busy"));
    await ops.failJob(j.id, Error("db busy"));
    await ops.failJob(j.id, Error("db busy"));
    expect((await ops.job(j.id))?.status).toBe("failed");
    expect((await ops.job(j.id))?.nextRunAt).toBeNull();
  });
});
describe("typed fetch failures", () => {
  it("parses numeric and HTTP-date Retry-After conservatively", () => {
    const now = Date.parse("2026-09-08T12:00:00Z");
    expect(parseRetryAfter("120", now)).toBe("2026-09-08T12:02:00.000Z");
    expect(parseRetryAfter("Tue, 08 Sep 2026 13:00:00 GMT", now)).toBe(
      "2026-09-08T13:00:00.000Z",
    );
    expect(parseRetryAfter("-5", now)).toBeUndefined();
    expect(parseRetryAfter("nonsense", now)).toBeUndefined();
    expect(parseRetryAfter("9".repeat(200), now)).toBeUndefined();
  });
  it("distinguishes policy/access/layout/network/rate/server and budget failures", () => {
    expect(
      classifyFailure(Error("Robots policy disallows this path")).kind,
    ).toBe("policy");
    expect(classifyFailure(Error("Source HTTP 403")).kind).toBe("access");
    expect(
      classifyFailure(Error("Expected matching detail identity unavailable"))
        .kind,
    ).toBe("layout");
    expect(classifyFailure(Error("Source request timed out")).kind).toBe(
      "network",
    );
    expect(failureFromResponse(429, { "retry-after": "120" }).kind).toBe(
      "rate-limit",
    );
    expect(failureFromResponse(503).kind).toBe("server");
    expect(
      classifyFailure({ kind: "budget", retryAfterAt: "2026-09-09T00:00:00Z" })
        .retryAfterAt,
    ).toBe("2026-09-09T00:00:00Z");
  });
});
