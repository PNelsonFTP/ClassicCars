import { createHash, randomUUID } from "node:crypto";
import { classifyFailure, type FailureRecord } from "./failures";

/** Compare-and-swap prevents API cancellation and worker checkpoints overwriting each other. */
export interface OperationsStore {
  get(key: string): Promise<string | null>;
  list(prefix: string): Promise<{ key: string; value: string }[]>;
  cas(key: string, previous: string | null, value: string): Promise<boolean>;
}
export type Scope = "regional" | "nationwide";
export type JobStatus =
  | "queued"
  | "running"
  | "partial"
  | "interrupted"
  | "completed"
  | "failed"
  | "cancelled";
export type CollectionJob = {
  id: string;
  scope: Scope;
  kind: "collection" | "geocode" | "routes";
  limit?: number;
  sourceId?: string;
  pageCap?: number;
  detailCap?: number;
  smoke: boolean;
  fresh?: boolean;
  origin: "manual" | "schedule" | "legacy";
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  heartbeatAt?: string;
  nextRunAt: string | null;
  attempts: number;
  failures: number;
  cancellationRequested: boolean;
  parentJobId?: string;
  result?: unknown;
  error?: string;
};
export type SourceHealth = {
  sourceId: string;
  state: "active" | "cooldown" | "review" | "smoke-required";
  consecutiveFailures: number;
  nextPermittedAt: string | null;
  lastFailure?: FailureRecord & { at: string; url?: string };
  lastSuccessAt?: string;
  lastLiveValidatedAt?: string;
  reviewedAt?: string;
  reviewReason?: string;
  history: {
    at: string;
    action: string;
    reason: string;
    kind?: FailureRecord["kind"];
  }[];
};
export type CatalogTask = {
  terminal?: boolean;
  observedAt?: string;
  evidenceHash?: string;
  cacheHit?: boolean;
  parserVersion?: string;
  queryId: string;
  url: string;
  status: "pending" | "complete" | "blocked";
  attempts: number;
  nextAttemptAt: string | null;
  lastAttemptAt?: string;
  completedAt?: string;
  error?: FailureRecord;
};
export type CatalogCheckpoint = {
  id: string;
  sourceId: string;
  scope: Scope;
  configuredUrls: string[];
  cycle: number;
  startedAt: string;
  completedAt: string | null;
  tasks: CatalogTask[];
};
export type DetailTask = {
  listingId: string;
  url: string;
  scopes: Scope[];
  queryIds: string[];
  discoveredAt: string;
  status: "pending" | "complete" | "blocked";
  attempts: number;
  nextAttemptAt: string | null;
  lastAttemptAt?: string;
  completedAt?: string;
  error?: FailureRecord;
};
export type DetailQueue = {
  sourceId: string;
  items: Record<string, DetailTask>;
};
const PREFIX = "collection:v1:";
const iso = (n: number) => new Date(n).toISOString();
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 24);
export function canonicalPage(raw: string) {
  const u = new URL(raw);
  u.hash = "";
  for (const name of ["page", "p"])
    if (u.searchParams.get(name) === "1") u.searchParams.delete(name);
  u.searchParams.sort();
  return u.href;
}
const freshHealth = (sourceId: string): SourceHealth => ({
  sourceId,
  state: "active",
  consecutiveFailures: 0,
  nextPermittedAt: null,
  history: [],
});
function appendHealth(
  h: SourceHealth,
  at: string,
  action: string,
  reason: string,
  kind?: FailureRecord["kind"],
) {
  h.history = [...h.history, { at, action, reason, kind }].slice(-100);
}
export class CollectionOperations {
  constructor(
    readonly store: OperationsStore,
    readonly now: () => number = Date.now,
  ) {}
  async read<T>(key: string): Promise<T | null> {
    const raw = await this.store.get(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  async mutate<T>(
    key: string,
    initial: () => T,
    fn: (value: T) => T,
  ): Promise<T> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const raw = await this.store.get(PREFIX + key);
      const value = fn(raw ? (JSON.parse(raw) as T) : initial());
      if (await this.store.cas(PREFIX + key, raw, JSON.stringify(value)))
        return value;
    }
    throw new Error(
      "Concurrent collection state updates did not settle; work remains durable.",
    );
  }
  async enqueue(
    input: Partial<
      Pick<
        CollectionJob,
        | "kind"
        | "limit"
        | "sourceId"
        | "pageCap"
        | "detailCap"
        | "smoke"
        | "fresh"
        | "origin"
        | "parentJobId"
      >
    > & { scope: Scope },
  ) {
    const at = iso(this.now());
    const job: CollectionJob = {
      id: randomUUID(),
      scope: input.scope,
      kind: input.kind || "collection",
      limit: input.limit,
      sourceId: input.sourceId,
      pageCap: input.pageCap,
      detailCap: input.detailCap,
      smoke: input.smoke || false,
      fresh: input.fresh || false,
      origin: input.origin || "manual",
      parentJobId: input.parentJobId,
      status: "queued",
      createdAt: at,
      updatedAt: at,
      nextRunAt: at,
      attempts: 0,
      failures: 0,
      cancellationRequested: false,
    };
    if (
      !(await this.store.cas(
        PREFIX + "job:" + job.id,
        null,
        JSON.stringify(job),
      ))
    )
      throw new Error("Job ID collision.");
    return job;
  }
  async jobs() {
    return (await this.store.list(PREFIX + "job:"))
      .map((r) => JSON.parse(r.value) as CollectionJob)
      .sort(
        (a, b) =>
          b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
      );
  }
  job(id: string) {
    return this.read<CollectionJob>("job:" + id);
  }
  async updateJob(id: string, fn: (job: CollectionJob) => CollectionJob) {
    return this.mutate<CollectionJob>(
      "job:" + id,
      () => {
        throw new Error("Unknown collection job.");
      },
      (job) => ({ ...fn(job), updatedAt: iso(this.now()) }),
    );
  }
  async claim(id: string) {
    let claimed = false;
    const job = await this.updateJob(id, (j) => {
      claimed = false;
      if (
        !["queued", "partial", "interrupted"].includes(j.status) ||
        !j.nextRunAt ||
        Date.parse(j.nextRunAt) > this.now() ||
        j.cancellationRequested
      )
        return j;
      claimed = true;
      return {
        ...j,
        status: "running",
        startedAt: j.startedAt || iso(this.now()),
        heartbeatAt: iso(this.now()),
        attempts: j.attempts + 1,
        nextRunAt: null,
        error: undefined,
      };
    });
    return claimed ? job : null;
  }
  async nextJob() {
    const eligible = (await this.jobs()).filter(
      (j) =>
        ["queued", "partial", "interrupted"].includes(j.status) &&
        j.nextRunAt &&
        Date.parse(j.nextRunAt) <= this.now() &&
        !j.cancellationRequested,
    );
    eligible.sort(
      (a, b) =>
        (a.nextRunAt || "").localeCompare(b.nextRunAt || "") ||
        a.createdAt.localeCompare(b.createdAt),
    );
    return eligible[0] ? this.claim(eligible[0].id) : null;
  }
  async heartbeat(id: string) {
    return this.updateJob(id, (j) =>
      j.status === "running" ? { ...j, heartbeatAt: iso(this.now()) } : j,
    );
  }
  async cancel(id: string) {
    return this.updateJob(id, (j) =>
      ["completed", "failed", "cancelled"].includes(j.status)
        ? j
        : {
            ...j,
            cancellationRequested: true,
            nextRunAt: null,
            status: j.status === "running" ? "running" : "cancelled",
            finishedAt: j.status === "running" ? undefined : iso(this.now()),
          },
    );
  }
  async retry(id: string) {
    const previous = await this.job(id);
    if (!previous) throw new Error("Unknown collection job.");
    if (previous.status === "running" || previous.status === "queued")
      throw new Error("This job is already active.");
    return this.enqueue({ ...previous, parentJobId: id, origin: "manual" });
  }
  async finish(
    id: string,
    result: unknown,
    state: "completed" | "partial" | "interrupted",
    nextRunAt: string | null = null,
  ) {
    return this.updateJob(id, (j) => ({
      ...j,
      status: j.cancellationRequested ? "cancelled" : state,
      result,
      nextRunAt: j.cancellationRequested ? null : nextRunAt,
      finishedAt:
        j.cancellationRequested || state === "completed"
          ? iso(this.now())
          : undefined,
    }));
  }
  async failJob(id: string, error: unknown) {
    return this.updateJob(id, (j) => {
      const failures = j.failures + 1;
      return {
        ...j,
        failures,
        status: j.cancellationRequested
          ? "cancelled"
          : failures >= 3
            ? "failed"
            : "interrupted",
        error: error instanceof Error ? error.message : String(error),
        nextRunAt:
          j.cancellationRequested || failures >= 3
            ? null
            : iso(this.now() + Math.min(3600, 60 * 2 ** (failures - 1)) * 1000),
        finishedAt:
          failures >= 3 || j.cancellationRequested
            ? iso(this.now())
            : undefined,
      };
    });
  }
  async recoverJobs(expiredMs = 120000) {
    const recovered: CollectionJob[] = [];
    for (const job of await this.jobs()) {
      if (
        job.status !== "running" ||
        this.now() - Date.parse(job.heartbeatAt || job.updatedAt) < expiredMs
      )
        continue;
      recovered.push(
        await this.updateJob(job.id, (current) =>
          current.status === "running" &&
          this.now() - Date.parse(current.heartbeatAt || current.updatedAt) >=
            expiredMs
            ? {
                ...current,
                status: current.cancellationRequested
                  ? "cancelled"
                  : "interrupted",
                nextRunAt: current.cancellationRequested
                  ? null
                  : iso(this.now()),
                error:
                  "Prior worker interrupted; persisted checkpoints are retained.",
              }
            : current,
        ),
      );
    }
    return recovered;
  }
  async health(sourceId: string) {
    return (
      (await this.read<SourceHealth>("health:" + sourceId)) ||
      freshHealth(sourceId)
    );
  }
  async allHealth() {
    return (await this.store.list(PREFIX + "health:")).map(
      (r) => JSON.parse(r.value) as SourceHealth,
    );
  }
  async allowed(sourceId: string, smoke = false) {
    const h = await this.health(sourceId);
    return (
      h.state !== "review" &&
      (h.state !== "smoke-required" || smoke) &&
      (!h.nextPermittedAt || Date.parse(h.nextPermittedAt) <= this.now())
    );
  }
  async failure(sourceId: string, error: unknown, url?: string) {
    const f = classifyFailure(error, this.now());
    return this.mutate(
      "health:" + sourceId,
      () => freshHealth(sourceId),
      (h) => {
        h.lastFailure = { ...f, at: iso(this.now()), url };
        if (f.kind === "cancelled") return h;
        h.consecutiveFailures++;
        const permanent = ["policy", "access", "layout"].includes(f.kind);
        const transient = [
          "network",
          "rate-limit",
          "server",
          "budget",
        ].includes(f.kind);
        if (permanent || (transient && h.consecutiveFailures >= 3)) {
          h.state = "review";
          h.nextPermittedAt = f.retryAfterAt || null;
        } else if (transient) {
          h.state = "cooldown";
          const floor = f.kind === "rate-limit" ? 900000 : 60000;
          h.nextPermittedAt = iso(
            Math.max(
              this.now() +
                Math.min(86400000, floor * 2 ** (h.consecutiveFailures - 1)),
              Date.parse(f.retryAfterAt || "") || 0,
            ),
          );
        }
        appendHealth(h, iso(this.now()), h.state, f.message, f.kind);
        return h;
      },
    );
  }
  async success(sourceId: string, liveParsed: boolean, smokeCompleted = false) {
    return this.mutate(
      "health:" + sourceId,
      () => freshHealth(sourceId),
      (h) => {
        h.lastSuccessAt = iso(this.now());
        // Cached content and a request without successful parsing cannot validate a repair.
        if (
          h.state === "review" ||
          (h.state === "smoke-required" && (!smokeCompleted || !liveParsed))
        )
          return h;
        if (h.state === "smoke-required" && smokeCompleted && liveParsed)
          h.lastLiveValidatedAt = iso(this.now());
        else if (liveParsed && h.state === "active")
          h.lastLiveValidatedAt = iso(this.now());
        if (h.state !== "active")
          appendHealth(
            h,
            iso(this.now()),
            "active",
            smokeCompleted
              ? "Permitted live smoke parsing succeeded."
              : "Permitted request and parser succeeded.",
          );
        h.state = "active";
        h.consecutiveFailures = 0;
        h.nextPermittedAt = null;
        return h;
      },
    );
  }
  async reviewSource(
    sourceId: string,
    action: "pause" | "request-smoke",
    reason: string,
  ) {
    if (reason.trim().length < 8)
      throw new Error("Record a review reason of at least eight characters.");
    return this.mutate(
      "health:" + sourceId,
      () => freshHealth(sourceId),
      (h) => {
        h.state = action === "pause" ? "review" : "smoke-required";
        h.reviewedAt = iso(this.now());
        h.reviewReason = reason.trim();
        h.consecutiveFailures = 0;
        // A review never shortens a server's explicit Retry-After or another existing cooldown.
        if (h.nextPermittedAt && Date.parse(h.nextPermittedAt) <= this.now())
          h.nextPermittedAt = null;
        appendHealth(h, iso(this.now()), action, reason.trim());
        return h;
      },
    );
  }
  checkpointId(sourceId: string, scope: Scope, urls: string[]) {
    return (
      sourceId +
      ":" +
      scope +
      ":" +
      hash(urls.map(canonicalPage).sort().join("\n"))
    );
  }
  async checkpoint(
    sourceId: string,
    scope: Scope,
    urls: string[],
    refreshMs: number,
  ) {
    const configuredUrls = [...new Set(urls.map(canonicalPage))];
    const id = this.checkpointId(sourceId, scope, configuredUrls);
    const initial = (): CatalogCheckpoint => ({
      id,
      sourceId,
      scope,
      configuredUrls,
      cycle: 1,
      startedAt: iso(this.now()),
      completedAt: null,
      tasks: configuredUrls.map((url) => ({
        queryId: hash(url),
        url,
        status: "pending",
        attempts: 0,
        nextAttemptAt: null,
      })),
    });
    return this.mutate("catalog:" + id, initial, (c) => {
      if (c.completedAt && this.now() - Date.parse(c.completedAt) >= refreshMs)
        return { ...initial(), cycle: c.cycle + 1 };
      return c;
    });
  }
  async catalogTasks(id: string) {
    const cp = await this.read<CatalogCheckpoint>("catalog:" + id);
    if (!cp) throw new Error("Unknown catalog checkpoint.");
    return cp.tasks.filter(
      (t) =>
        t.status === "pending" &&
        (!t.nextAttemptAt || Date.parse(t.nextAttemptAt) <= this.now()),
    );
  }
  async completePage(
    id: string,
    task: CatalogTask,
    next: string[],
    evidence?: {
      observedAt: string;
      evidenceHash: string;
      cacheHit: boolean;
      parserVersion: string;
    },
  ) {
    return this.mutate<CatalogCheckpoint>(
      "catalog:" + id,
      () => {
        throw new Error("Unknown catalog checkpoint.");
      },
      (cp) => {
        const page = cp.tasks.find(
          (t) => t.queryId === task.queryId && t.url === task.url,
        );
        if (!page) throw new Error("Catalog task no longer exists.");
        page.status = "complete";
        page.terminal = next.length === 0;
        if (evidence) Object.assign(page, evidence);
        page.completedAt = iso(this.now());
        page.lastAttemptAt = iso(this.now());
        page.attempts++;
        delete page.error;
        for (const url of next.map(canonicalPage))
          if (
            !cp.tasks.some((t) => t.queryId === task.queryId && t.url === url)
          )
            cp.tasks.push({
              queryId: task.queryId,
              url,
              status: "pending",
              attempts: 0,
              nextAttemptAt: null,
            });
        cp.completedAt = cp.tasks.every((t) => t.status === "complete")
          ? iso(this.now())
          : null;
        return cp;
      },
    );
  }
  async failPage(
    id: string,
    task: CatalogTask,
    error: unknown,
    health: SourceHealth,
  ) {
    return this.mutate<CatalogCheckpoint>(
      "catalog:" + id,
      () => {
        throw new Error("Unknown catalog checkpoint.");
      },
      (cp) => {
        const page = cp.tasks.find(
          (t) => t.queryId === task.queryId && t.url === task.url,
        );
        if (page) {
          page.error = classifyFailure(error, this.now());
          page.status =
            health.state === "review" || page.error.kind === "missing"
              ? "blocked"
              : "pending";
          page.attempts++;
          page.lastAttemptAt = iso(this.now());
          page.nextAttemptAt = health.nextPermittedAt;
        }
        return cp;
      },
    );
  }
  async details(sourceId: string) {
    return (
      (await this.read<DetailQueue>("details:" + sourceId)) || {
        sourceId,
        items: {},
      }
    );
  }
  async discoverDetails(
    sourceId: string,
    scope: Scope,
    queryId: string,
    rows: {
      id: string;
      url: string;
      lastDetailObservedAt?: string | null;
      lastDetailAttemptAt?: string | null;
      parserVersion?: string;
      lastObservedAt?: string;
    }[],
  ) {
    return this.mutate(
      "details:" + sourceId,
      () => ({ sourceId, items: {} }) as DetailQueue,
      (q) => {
        for (const row of rows) {
          const prior = q.items[row.id];
          const observed =
            row.lastDetailObservedAt ||
            (row.parserVersion?.includes("detail")
              ? row.lastObservedAt
              : undefined);
          if (prior) {
            prior.url = row.url;
            if (!prior.scopes.includes(scope)) prior.scopes.push(scope);
            if (!prior.queryIds.includes(queryId)) prior.queryIds.push(queryId);
          } else
            q.items[row.id] = {
              listingId: row.id,
              url: row.url,
              scopes: [scope],
              queryIds: [queryId],
              discoveredAt: iso(this.now()),
              status: observed ? "complete" : "pending",
              attempts: 0,
              nextAttemptAt: null,
              completedAt: observed || undefined,
              lastAttemptAt: row.lastDetailAttemptAt || undefined,
            };
        }
        return q;
      },
    );
  }
  async detailTasks(
    sourceId: string,
    scope: Scope,
    maxAgeMs: number | ((id: string) => number),
  ) {
    const q = await this.details(sourceId);
    return Object.values(q.items)
      .filter(
        (t) =>
          t.scopes.includes(scope) &&
          t.status !== "blocked" &&
          (!t.nextAttemptAt || Date.parse(t.nextAttemptAt) <= this.now()) &&
          (t.status !== "complete" ||
            !t.completedAt ||
            this.now() - Date.parse(t.completedAt) >=
              (typeof maxAgeMs === "number"
                ? maxAgeMs
                : maxAgeMs(t.listingId))),
      )
      .sort(
        (a, b) =>
          (a.lastAttemptAt || "").localeCompare(b.lastAttemptAt || "") ||
          a.discoveredAt.localeCompare(b.discoveredAt) ||
          a.listingId.localeCompare(b.listingId),
      );
  }
  async completeDetail(sourceId: string, id: string, observedAt: string) {
    return this.mutate(
      "details:" + sourceId,
      () => ({ sourceId, items: {} }) as DetailQueue,
      (q) => {
        const task = q.items[id];
        if (task) {
          task.status = "complete";
          task.attempts++;
          task.lastAttemptAt = iso(this.now());
          task.completedAt = observedAt;
          task.nextAttemptAt = null;
          delete task.error;
        }
        return q;
      },
    );
  }
  async failDetail(
    sourceId: string,
    id: string,
    error: unknown,
    health: SourceHealth,
  ) {
    return this.mutate(
      "details:" + sourceId,
      () => ({ sourceId, items: {} }) as DetailQueue,
      (q) => {
        const task = q.items[id];
        if (task) {
          task.error = classifyFailure(error, this.now());
          task.status =
            health.state === "review" ||
            task.error.kind === "missing" ||
            task.attempts >= 2
              ? "blocked"
              : "pending";
          task.attempts++;
          task.lastAttemptAt = iso(this.now());
          task.nextAttemptAt = health.nextPermittedAt;
        }
        return q;
      },
    );
  }
  /** Manual reviewed resume reopens failed tasks, retaining their original error/attempt history. */
  async reopenSourceTasks(sourceId: string) {
    for (const row of await this.store.list(
      PREFIX + "catalog:" + sourceId + ":",
    )) {
      const cp = JSON.parse(row.value) as CatalogCheckpoint;
      await this.mutate<CatalogCheckpoint>(
        "catalog:" + cp.id,
        () => cp,
        (current) => {
          for (const t of current.tasks)
            if (t.status === "blocked") {
              t.status = "pending";
              t.nextAttemptAt = null;
            }
          return current;
        },
      );
    }
    return this.mutate(
      "details:" + sourceId,
      () => ({ sourceId, items: {} }) as DetailQueue,
      (q) => {
        for (const t of Object.values(q.items))
          if (t.status === "blocked") {
            t.status = "pending";
            t.nextAttemptAt = null;
          }
        return q;
      },
    );
  }
  async progress(sourceId?: string) {
    const health = await this.allHealth();
    const catalogs = (await this.store.list(PREFIX + "catalog:"))
      .map((r) => JSON.parse(r.value) as CatalogCheckpoint)
      .filter((c) => !sourceId || c.sourceId === sourceId);
    const queues = (await this.store.list(PREFIX + "details:"))
      .map((r) => JSON.parse(r.value) as DetailQueue)
      .filter((q) => !sourceId || q.sourceId === sourceId);
    return {
      catalogs: catalogs.map((c) => ({
        ...c,
        counts: {
          total: c.tasks.length,
          complete: c.tasks.filter((t) => t.status === "complete").length,
          pending: c.tasks.filter((t) => t.status === "pending").length,
          blocked: c.tasks.filter((t) => t.status === "blocked").length,
        },
      })),
      details: queues.map((q) => ({
        sourceId: q.sourceId,
        counts: {
          total: Object.keys(q.items).length,
          complete: Object.values(q.items).filter(
            (t) => t.status === "complete",
          ).length,
          pending: Object.values(q.items).filter((t) => t.status === "pending")
            .length,
          blocked: Object.values(q.items).filter((t) => t.status === "blocked")
            .length,
        },
        scopes: Object.fromEntries(
          (["regional", "nationwide"] as const).map((scope) => [
            scope,
            Object.values(q.items).filter((t) => t.scopes.includes(scope))
              .length,
          ]),
        ),
      })),
      health: health.filter((h) => !sourceId || h.sourceId === sourceId),
    };
  }
}
