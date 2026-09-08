import type { Listing } from "../../shared/schema";
import type { SourceConfig } from "./adapters";
import { classifyFailure, type FailureRecord } from "./failures";
import {
  type CollectionOperations,
  type DetailQueue,
  type SourceHealth,
} from "./operations";
export type BootstrapRun = {
  id?: string;
  sourceId: string;
  status: string;
  scope: string;
  startedAt: string | Date;
  finishedAt?: string | Date | null;
  error?: string | null;
  stats?: unknown;
};
export type BootstrapInput = {
  listings: Listing[];
  sources: SourceConfig[];
  runs: BootstrapRun[];
  now?: number;
};
const asStats = (value: unknown): Record<string, unknown> => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};
function stamp(value: unknown, now: number) {
  const n =
    value instanceof Date
      ? value.getTime()
      : typeof value === "string"
        ? Date.parse(value)
        : NaN;
  return Number.isFinite(n) && n <= now ? new Date(n).toISOString() : undefined;
}
function recordedFailure(
  run: BootstrapRun | undefined,
  now: number,
): FailureRecord | undefined {
  if (!run) return;
  const stats = asStats(run.stats);
  const pageMessages = (
    Array.isArray(stats.failedPages) ? stats.failedPages : []
  ).filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
  const access =
    stats.accessHealth && typeof stats.accessHealth === "object"
      ? (stats.accessHealth as Record<string, unknown>)
      : undefined;
  // New collectors retain historical lastFailure even after recovery. It is not a new failure.
  if (
    access?.state === "active" &&
    !pageMessages.length &&
    !stats.failedInventoryPages &&
    !stats.failedDetails
  )
    return;
  const messages = [
    ...pageMessages,
    ...(run.status !== "complete" &&
    typeof run.error === "string" &&
    run.error.trim()
      ? [run.error]
      : []),
  ];
  const nested = access?.state !== "active" ? access?.lastFailure : undefined;
  if (
    nested &&
    typeof nested === "object" &&
    typeof (nested as Record<string, unknown>).message === "string"
  )
    messages.push((nested as { message: string }).message);
  if (!messages.length) return;
  const failures = messages.map((message) =>
    classifyFailure(new Error(message), now),
  );
  // A concrete denial takes priority over an incidental parser or detail error in the same run.
  const priority = [
    "policy",
    "access",
    "rate-limit",
    "server",
    "network",
    "layout",
    "budget",
    "missing",
    "cancelled",
  ];
  failures.sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind));
  const failure = failures[0];
  if (nested && typeof nested === "object") {
    const retryAfterAt = (nested as Record<string, unknown>).retryAfterAt;
    if (
      typeof retryAfterAt === "string" &&
      Number.isFinite(Date.parse(retryAfterAt))
    )
      failure.retryAfterAt = retryAfterAt;
  }
  return failure;
}
/** Offline, idempotent migration of retained evidence into operations state. Creates no jobs or requests. */
export async function bootstrapLegacyOperations(
  operations: CollectionOperations,
  input: BootstrapInput,
) {
  const now = input.now ?? Date.now(),
    sources = new Map(input.sources.map((source) => [source.id, source])),
    bySource = new Map<string, Listing[]>();
  let skippedSamples = 0;
  for (const listing of input.listings) {
    if (listing.isSample) {
      skippedSamples++;
      continue;
    }
    const rows = bySource.get(listing.sourceId) || [];
    rows.push(listing);
    bySource.set(listing.sourceId, rows);
  }
  const summaries: {
    sourceId: string;
    retainedAds: number;
    addedDetails: number;
    healthCreated: boolean;
    healthState: SourceHealth["state"];
    lastObservationAt: string | null;
    scopeMembership: Record<"regional" | "nationwide", number>;
  }[] = [];
  for (const sourceId of new Set([...sources.keys(), ...bySource.keys()])) {
    const source = sources.get(sourceId),
      rows = bySource.get(sourceId) || [];
    const observations = rows
      .map((row) => stamp(row.lastObservedAt, now))
      .filter((v): v is string => Boolean(v))
      .sort();
    const lastObservationAt = observations.at(-1) || null;
    const runs = input.runs
      .filter(
        (run) =>
          run.sourceId === sourceId &&
          ["regional", "nationwide"].includes(run.scope) &&
          run.status !== "running" &&
          stamp(run.finishedAt || run.startedAt, now),
      )
      .sort(
        (a, b) =>
          Date.parse(stamp(b.finishedAt || b.startedAt, now)!) -
          Date.parse(stamp(a.finishedAt || a.startedAt, now)!),
      );
    const latestRun = runs[0];
    const latestHealth = asStats(asStats(latestRun?.stats).accessHealth);
    const latestFailure = asStats(latestHealth.lastFailure);
    const failureAt = latestRun
      ? stamp(latestFailure.at, now) ||
        stamp(latestRun.finishedAt || latestRun.startedAt, now)!
      : null;
    const failure = recordedFailure(latestRun, now);
    const existing = await operations.read<SourceHealth>("health:" + sourceId);
    let health = existing,
      healthCreated = false;
    if (!health) {
      const proposed: SourceHealth = {
        sourceId,
        state: "active",
        consecutiveFailures: 0,
        nextPermittedAt: null,
        history: [],
        ...(lastObservationAt ? { lastSuccessAt: lastObservationAt } : {}),
      };
      if (failure && failure.kind !== "cancelled" && failureAt) {
        proposed.lastFailure = { ...failure, at: failureAt };
        proposed.consecutiveFailures = 1;
        if (["policy", "access", "layout"].includes(failure.kind)) {
          proposed.state = "review";
          proposed.nextPermittedAt = failure.retryAfterAt || null;
        } else if (
          ["rate-limit", "server", "network", "budget"].includes(failure.kind)
        ) {
          proposed.state = "cooldown";
          proposed.nextPermittedAt = new Date(
            Math.max(
              Date.parse(failureAt) +
                (failure.kind === "rate-limit" ? 900000 : 60000),
              Date.parse(failure.retryAfterAt || "") || 0,
            ),
          ).toISOString();
        }
        proposed.history.push({
          at: failureAt,
          action: "legacy-failure",
          reason: `Retained run ${latestRun?.id || "without ID"}: ${failure.message}`,
          kind: failure.kind,
        });
      }
      if (
        source?.enabled &&
        !latestRun &&
        ([
          "blocked",
          "restricted",
          "permission-required",
          "credential-required",
          "manual-only",
        ].includes(source.status) ||
          /\b403\b|robots disallow|AI crawling|requires permission|challenge/i.test(
            source.note,
          ))
      ) {
        proposed.state = "review";
        proposed.history.push({
          at: new Date(now).toISOString(),
          action: "configuration-review",
          reason: `Previously documented configuration requires review; no new access observation was made. ${source.note}`,
          kind: "policy",
        });
      }
      if (!source?.enabled) {
        proposed.state = "review";
        proposed.history.push({
          at: new Date(now).toISOString(),
          action: "configuration-review",
          reason: source
            ? `Source remains ${source.status || "disabled"} in configuration. Bootstrap does not enable it. ${source.note || ""}`
            : "No configured automated adapter. Retain manual/feed observations without automatic detail collection.",
          kind: "policy",
        });
      }
      proposed.history.push({
        at: lastObservationAt || failureAt || new Date(now).toISOString(),
        action: "legacy-bootstrap",
        reason:
          "Initialized from retained local records only; no request, new observation, repair validation or collection job was created.",
      });
      // A concurrent collector/reviewer wins; never overwrite a health decision that appeared during bootstrap.
      health = await operations.mutate(
        "health:" + sourceId,
        () => proposed,
        (current) => current,
      );
      healthCreated = health === proposed;
    }
    let addedDetails = 0;
    await operations.mutate(
      "details:" + sourceId,
      () => ({ sourceId, items: {} }) as DetailQueue,
      (queue) => {
        addedDetails = 0;
        for (const row of rows) {
          const scope = row.scope,
            prior = queue.items[row.id];
          if (prior) {
            if (!prior.scopes.includes(scope)) prior.scopes.push(scope);
            if (!prior.queryIds.includes("legacy-observation"))
              prior.queryIds.push("legacy-observation");
            continue;
          }
          const observed = row.lastDetailObservedAt
            ? stamp(row.lastDetailObservedAt, now)
            : row.parserVersion.includes("detail")
              ? stamp(row.lastObservedAt, now)
              : undefined;
          const discoveredAt =
            stamp(row.firstSeenAt, now) ||
            stamp(row.lastObservedAt, now) ||
            new Date(now).toISOString();
          const blocked = health!.state === "review" || !source?.enabled;
          queue.items[row.id] = {
            listingId: row.id,
            url: row.url,
            scopes: [scope],
            queryIds: ["legacy-observation"],
            discoveredAt,
            status: observed ? "complete" : blocked ? "blocked" : "pending",
            attempts: 0,
            nextAttemptAt: null,
            ...(observed ? { completedAt: observed } : {}),
            ...(stamp(row.lastDetailAttemptAt, now)
              ? { lastAttemptAt: stamp(row.lastDetailAttemptAt, now) }
              : {}),
            ...(!observed && blocked
              ? {
                  error: health!.lastFailure || {
                    kind: "policy" as const,
                    message: source?.enabled
                      ? "Source requires access review before detail work."
                      : "Source adapter is disabled or unconfigured; no automatic detail request is authorized.",
                  },
                }
              : {}),
          };
          addedDetails++;
        }
        return queue;
      },
    );
    summaries.push({
      sourceId,
      retainedAds: rows.length,
      addedDetails,
      healthCreated,
      healthState: health.state,
      lastObservationAt,
      scopeMembership: {
        regional: rows.filter((r) => r.scope === "regional").length,
        nationwide: rows.filter((r) => r.scope === "nationwide").length,
      },
    });
  }
  return {
    schemaVersion: 1,
    bootstrappedAt: new Date(now).toISOString(),
    networkRequests: 0,
    jobsCreated: 0,
    catalogCheckpointsCreated: 0,
    skippedSamples,
    sources: summaries,
  };
}
