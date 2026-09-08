"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CollectionJob,
  CatalogCheckpoint,
  SourceHealth,
} from "../server/ingest/operations";
import type { ServiceBudget } from "../server/service-budget";
export type OperationsApi = <T = unknown>(
  path: string,
  options?: RequestInit,
) => Promise<T>;
type Counts = {
  total: number;
  complete: number;
  pending: number;
  blocked: number;
};
type Progress = {
  catalogs: (CatalogCheckpoint & { counts: Counts })[];
  details: {
    sourceId: string;
    counts: Counts;
    scopes: Record<"regional" | "nationwide", number>;
  }[];
  health: SourceHealth[];
};
type SourceChoice = { id: string; name: string; enabled?: boolean };
const when = (value?: string | null) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString()
    : "—";
const terminal = (job: CollectionJob) =>
  ["completed", "failed", "cancelled"].includes(job.status);
const jobName = (job: CollectionJob) =>
  job.kind === "geocode"
    ? "Geocode actual locations"
    : job.kind === "routes"
      ? "Calculate driving routes"
      : `${job.scope === "nationwide" ? "Nationwide" : "Regional"} collection${job.smoke ? " · smoke check" : ""}`;
const pageSize = 10;
/** Render only after connecting to the authenticated local API. */
export function OperationsPanel({
  api,
  onRefresh,
  sources = [],
}: {
  api: OperationsApi;
  onRefresh?: () => void | Promise<void>;
  sources?: SourceChoice[];
}) {
  const apiRef = useRef(api),
    refreshRef = useRef(onRefresh),
    alive = useRef(false),
    inFlight = useRef(false);
  apiRef.current = api;
  refreshRef.current = onRefresh;
  const [jobs, setJobs] = useState<CollectionJob[]>([]),
    [progress, setProgress] = useState<Progress>({
      catalogs: [],
      details: [],
      health: [],
    }),
    [budgets, setBudgets] = useState<ServiceBudget[]>([]);
  const [loadedAt, setLoadedAt] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"regional" | "nationwide">("regional"),
    [kind, setKind] = useState<CollectionJob["kind"]>("collection"),
    [sourceId, setSourceId] = useState(""),
    [limit, setLimit] = useState(10),
    [pageCap, setPageCap] = useState(1),
    [detailCap, setDetailCap] = useState(1);
  const [reviewSource, setReviewSource] = useState(""),
    [reviewReason, setReviewReason] = useState(""),
    [reviewAction, setReviewAction] = useState<"pause" | "request-smoke">(
      "pause",
    ),
    [jobPage, setJobPage] = useState(0),
    [showOnlyActive, setShowOnlyActive] = useState(false);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const results = await Promise.allSettled([
      apiRef.current<CollectionJob[]>("/api/jobs"),
      apiRef.current<Progress>("/api/collection/progress"),
      apiRef.current<ServiceBudget[]>("/api/service-budgets"),
    ]);
    if (alive.current) {
      if (results[0].status === "fulfilled") setJobs(results[0].value);
      if (results[1].status === "fulfilled") setProgress(results[1].value);
      if (results[2].status === "fulfilled") setBudgets(results[2].value);
      const failures = results.filter(
        (r): r is PromiseRejectedResult => r.status === "rejected",
      );
      if (failures.length)
        setError(
          failures
            .map((r) =>
              r.reason instanceof Error ? r.reason.message : String(r.reason),
            )
            .join(" · "),
        );
      setLoadedAt(new Date().toISOString());
      setLoading(false);
    }
    inFlight.current = false;
  }, []);
  useEffect(() => {
    alive.current = true;
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 15000);
    return () => {
      alive.current = false;
      clearInterval(interval);
    };
  }, [load]);
  async function change(path: string, body: unknown, success: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await apiRef.current(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (alive.current) setMessage(success);
      await load();
      await refreshRef.current?.();
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const choices = new Map(sources.map((s) => [s.id, s]));
  for (const id of [
    ...progress.catalogs.map((c) => c.sourceId),
    ...progress.health.map((h) => h.sourceId),
    ...jobs.flatMap((j) => (j.sourceId ? [j.sourceId] : [])),
  ])
    if (!choices.has(id)) choices.set(id, { id, name: id });
  const sourceChoices = [...choices.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const sourceName = (id: string) => choices.get(id)?.name || id;
  const visibleJobs = showOnlyActive ? jobs.filter((j) => !terminal(j)) : jobs;
  const maxPage = Math.max(0, Math.ceil(visibleJobs.length / pageSize) - 1),
    currentPage = Math.min(jobPage, maxPage);
  const displayed = visibleJobs.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  return (
    <section
      className="panel operations-panel"
      aria-label="Collection and service operations"
      style={{ gridColumn: "1 / -1" }}
    >
      <div className="section-heading">
        <h2>Collection &amp; service operations</h2>
        <button
          className="button"
          disabled={busy}
          onClick={() => {
            setError("");
            void load();
          }}
        >
          Refresh operations
        </button>
      </div>
      <p>
        Jobs retain page checkpoints and detail work between runs. Source
        restrictions, request budgets and review pauses stay in force. Geocoding
        and routing run only when you explicitly queue them.
      </p>
      <p className="field-help">
        {loading
          ? "Loading local operations…"
          : `Updated ${when(loadedAt)}. Active views refresh every 15 seconds.`}
      </p>
      {message && (
        <p className="notice-box" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice-box" role="alert">
          {error}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void change(
            "/api/jobs",
            {
              kind,
              scope,
              ...(kind === "collection"
                ? { ...(sourceId ? { sourceId } : {}), pageCap, detailCap }
                : { limit }),
            },
            "Job queued. The local worker will process it; its ID and progress appear below.",
          );
        }}
      >
        <div className="button-row" style={{ alignItems: "end" }}>
          <label className="manual-field">
            <span className="field-label">JOB</span>
            <select
              aria-label="Job kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as CollectionJob["kind"])}
            >
              <option value="collection">Collect inventory and details</option>
              <option value="geocode">Geocode actual locations</option>
              <option value="routes">Calculate driving routes</option>
            </select>
          </label>
          {kind === "collection" ? (
            <>
              <label className="manual-field">
                <span className="field-label">SCOPE</span>
                <select
                  aria-label="Job scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value as typeof scope)}
                >
                  <option value="regional">Regional</option>
                  <option value="nationwide">Nationwide</option>
                </select>
              </label>
              <label className="manual-field">
                <span className="field-label">SOURCE</span>
                <select
                  aria-label="Job source"
                  value={sourceId}
                  onChange={(e) => setSourceId(e.target.value)}
                >
                  <option value="">All enabled sources</option>
                  {sourceChoices
                    .filter((s) => s.enabled !== false)
                    .map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="manual-field">
                <span className="field-label">PAGES PER SOURCE</span>
                <input
                  aria-label="Pages per source"
                  type="number"
                  min={0}
                  max={100}
                  required
                  value={pageCap}
                  onChange={(e) => setPageCap(Number(e.target.value))}
                  style={{ width: 100 }}
                />
              </label>
              <label className="manual-field">
                <span className="field-label">DETAILS PER SOURCE</span>
                <input
                  aria-label="Details per source"
                  type="number"
                  min={0}
                  max={500}
                  required
                  value={detailCap}
                  onChange={(e) => setDetailCap(Number(e.target.value))}
                  style={{ width: 100 }}
                />
              </label>
            </>
          ) : (
            <label className="manual-field">
              <span className="field-label">MAXIMUM ITEMS</span>
              <input
                aria-label="Service job item limit"
                type="number"
                min={1}
                max={100}
                required
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                style={{ width: 100 }}
              />
            </label>
          )}
          <button
            className="button primary"
            type="submit"
            disabled={
              busy ||
              (kind === "collection" && pageCap === 0 && detailCap === 0)
            }
          >
            Queue job
          </button>
        </div>
        {kind === "collection" ? (
          <p className="field-help">
            Caps apply to each bounded pass. A partial collection job can
            continue in later passes from its saved checkpoint. Cancel it to
            stop further passes.
          </p>
        ) : (
          <p className="field-help">
            This sends bounded requests to your configured provider. Unknown or
            ambiguous actual locations remain in review; driving routes require
            authorized routing credentials.
          </p>
        )}
      </form>
      <details open>
        <summary>
          <strong>Durable jobs ({jobs.length})</strong>
        </summary>
        <label className="check-label">
          <input
            type="checkbox"
            checked={showOnlyActive}
            onChange={(e) => {
              setShowOnlyActive(e.target.checked);
              setJobPage(0);
            }}
          />{" "}
          Show pending, partial and running jobs
        </label>
        {displayed.length === 0 ? (
          <p>
            {loading
              ? "Loading…"
              : "No jobs in this view. Queue an explicit job above."}
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">State</th>
                  <th scope="col">Timing</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((job) => (
                  <tr key={job.id}>
                    <td data-label="Job">
                      <strong>{jobName(job)}</strong>
                      <br />
                      <span>
                        {job.sourceId
                          ? sourceName(job.sourceId)
                          : job.kind === "collection"
                            ? "All enabled sources"
                            : `Up to ${job.limit || 20} items`}
                      </span>
                      <br />
                      <small style={{ overflowWrap: "anywhere" }}>
                        {job.id}
                      </small>
                      {job.parentJobId && (
                        <details>
                          <summary>Retry lineage</summary>
                          <p style={{ overflowWrap: "anywhere" }}>
                            Retries job {job.parentJobId}.
                          </p>
                        </details>
                      )}
                    </td>
                    <td data-label="State">
                      {job.status}
                      {job.cancellationRequested && job.status === "running"
                        ? " · cancellation requested"
                        : ""}
                      <br />
                      <small>
                        {job.attempts} passes · {job.failures} job failures
                      </small>
                      {job.error && <p role="note">{job.error}</p>}
                      {job.result !== undefined && (
                        <details>
                          <summary>Recorded result</summary>
                          <pre
                            style={{
                              maxHeight: 240,
                              overflow: "auto",
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                              fontSize: 10,
                            }}
                          >
                            {JSON.stringify(job.result, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                    <td data-label="Timing">
                      <small>
                        Created {when(job.createdAt)}
                        <br />
                        {job.nextRunAt
                          ? `Next pass ${when(job.nextRunAt)}`
                          : job.status === "partial"
                            ? "Waiting for review or manual retry"
                            : job.finishedAt
                              ? `Finished ${when(job.finishedAt)}`
                              : `Updated ${when(job.updatedAt)}`}
                      </small>
                    </td>
                    <td data-label="Actions">
                      <div className="button-row">
                        {!terminal(job) && (
                          <button
                            className="button"
                            disabled={busy || job.cancellationRequested}
                            onClick={() =>
                              void change(
                                `/api/jobs/${job.id}/cancel`,
                                {},
                                "Cancellation recorded. Work stops at the current request boundary; pending checkpoints remain.",
                              )
                            }
                          >
                            Cancel
                          </button>
                        )}
                        {!["queued", "running"].includes(job.status) && (
                          <button
                            className="button"
                            disabled={busy}
                            onClick={() =>
                              void change(
                                `/api/jobs/${job.id}/retry`,
                                {},
                                "A retry job was created with the prior job as its parent. Source cooldowns still apply.",
                              )
                            }
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {visibleJobs.length > pageSize && (
          <div className="button-row">
            <button
              className="button"
              disabled={currentPage === 0}
              onClick={() => setJobPage(currentPage - 1)}
            >
              Previous jobs
            </button>
            <span>
              Page {currentPage + 1} of {maxPage + 1}
            </span>
            <button
              className="button"
              disabled={currentPage === maxPage}
              onClick={() => setJobPage(currentPage + 1)}
            >
              Next jobs
            </button>
          </div>
        )}
      </details>
      <details>
        <summary>
          <strong>Catalog checkpoints and detail backlog</strong>
        </summary>
        <p>
          Catalog completion describes the configured source, query and scope.
          Pending or blocked pages never imply a vehicle was removed. Detail
          counts describe saved queue states; freshness checks determine which
          completed details are due again.
        </p>
        {!progress.catalogs.length ? (
          <p>No catalog checkpoints have been created yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Source / scope</th>
                  <th scope="col">Catalog pages</th>
                  <th scope="col">Cycle</th>
                  <th scope="col">Queries</th>
                </tr>
              </thead>
              <tbody>
                {progress.catalogs.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Source / scope">
                      {sourceName(c.sourceId)}
                      <br />
                      <small>{c.scope}</small>
                    </td>
                    <td data-label="Catalog pages">
                      {c.counts.complete} complete · {c.counts.pending} pending
                      · {c.counts.blocked} blocked
                      <br />
                      <small>{c.counts.total} discovered pages</small>
                    </td>
                    <td data-label="Cycle">
                      {c.cycle}
                      <br />
                      <small>
                        {c.completedAt
                          ? `Exhausted ${when(c.completedAt)}`
                          : "Still in progress"}
                      </small>
                    </td>
                    <td data-label="Queries">
                      <details>
                        <summary>
                          {c.configuredUrls.length} configured queries
                        </summary>
                        {c.configuredUrls.map((url) => (
                          <p key={url} style={{ overflowWrap: "anywhere" }}>
                            <a href={url} target="_blank" rel="noreferrer">
                              {url}
                            </a>
                          </p>
                        ))}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {progress.details.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Source detail queue</th>
                  <th scope="col">Saved state</th>
                  <th scope="col">Scope membership</th>
                </tr>
              </thead>
              <tbody>
                {progress.details.map((d) => (
                  <tr key={d.sourceId}>
                    <td data-label="Source detail queue">
                      {sourceName(d.sourceId)}
                    </td>
                    <td data-label="Saved state">
                      {d.counts.pending} pending · {d.counts.blocked} blocked ·{" "}
                      {d.counts.complete} previously completed
                      <br />
                      <small>{d.counts.total} total ads in queue</small>
                    </td>
                    <td data-label="Scope membership">
                      {d.scopes.regional} regional · {d.scopes.nationwide}{" "}
                      nationwide
                      <br />
                      <small>An ad can belong to both scopes.</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
      <details>
        <summary>
          <strong>Source access health and review</strong>
        </summary>
        <p>
          A review records your reason and can request a bounded ordinary smoke
          check. It cannot enable a disabled source, shorten a server’s
          Retry-After, grant permission, or bypass a challenge. A repair stays
          unvalidated until fresh catalog and detail parsing succeeds.
        </p>
        {progress.health.length === 0 ? (
          <p>
            No operational health observations yet. The source coverage report
            retains previously documented access restrictions.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col">Current state</th>
                  <th scope="col">Next permitted check</th>
                  <th scope="col">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {progress.health.map((h) => (
                  <tr key={h.sourceId}>
                    <td data-label="Source">{sourceName(h.sourceId)}</td>
                    <td data-label="Current state">
                      {h.state}
                      <br />
                      <small>
                        {h.lastFailure?.kind || "No classified failure"}
                      </small>
                    </td>
                    <td data-label="Next permitted check">
                      {h.state === "review"
                        ? "Manual review required"
                        : h.nextPermittedAt
                          ? when(h.nextPermittedAt)
                          : h.state === "smoke-required"
                            ? "Explicit smoke check required"
                            : "Subject to shared request budget"}
                    </td>
                    <td data-label="Evidence">
                      {h.lastFailure && <p>{h.lastFailure.message}</p>}
                      <small>
                        Last live validation: {when(h.lastLiveValidatedAt)}
                      </small>
                      <details>
                        <summary>Access history ({h.history.length})</summary>
                        {[...h.history].reverse().map((entry, i) => (
                          <p key={`${entry.at}-${i}`}>
                            <time dateTime={entry.at}>{when(entry.at)}</time> ·{" "}
                            {entry.action}
                            {entry.kind ? ` · ${entry.kind}` : ""}
                            <br />
                            {entry.reason}
                          </p>
                        ))}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void change(
              `/api/source-health/${encodeURIComponent(reviewSource)}/review`,
              { action: reviewAction, reason: reviewReason, scope },
              reviewAction === "pause"
                ? "Source paused with your review reason."
                : "Review recorded and a bounded smoke job queued. The existing cooldown is preserved.",
            );
          }}
        >
          <div className="button-row" style={{ alignItems: "end" }}>
            <label className="manual-field">
              <span className="field-label">REVIEW SOURCE</span>
              <select
                required
                aria-label="Review source"
                value={reviewSource}
                onChange={(e) => setReviewSource(e.target.value)}
              >
                <option value="">Choose a source</option>
                {sourceChoices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="manual-field">
              <span className="field-label">ACTION</span>
              <select
                aria-label="Source review action"
                value={reviewAction}
                onChange={(e) =>
                  setReviewAction(e.target.value as typeof reviewAction)
                }
              >
                <option value="pause">Pause for review</option>
                <option value="request-smoke">
                  Request a permitted smoke check
                </option>
              </select>
            </label>
            <label className="manual-field" style={{ flex: "1 1 220px" }}>
              <span className="field-label">
                REVIEW REASON / ACCESS EVIDENCE
              </span>
              <textarea
                aria-label="Source review reason"
                required
                minLength={8}
                maxLength={2000}
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                rows={2}
                style={{ width: "100%" }}
              />
            </label>
            <button
              className="button"
              type="submit"
              disabled={busy || !reviewSource || reviewReason.trim().length < 8}
            >
              Record source review
            </button>
          </div>
        </form>
      </details>
      <details>
        <summary>
          <strong>Shared provider request budgets</strong>
        </summary>
        <p>
          Reservations and cooldowns survive restarts and coordinate local
          processes. Cached pages do not consume network requests. The day shown
          is UTC.
        </p>
        {!budgets.length ? (
          <p>No provider request reservations have been recorded.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Provider / origin</th>
                  <th scope="col">Recorded requests</th>
                  <th scope="col">Next reserved slot</th>
                  <th scope="col">Cooldown</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => (
                  <tr key={b.service}>
                    <td
                      data-label="Provider / origin"
                      style={{ overflowWrap: "anywhere" }}
                    >
                      {b.service}
                    </td>
                    <td data-label="Recorded requests">
                      {b.requests} on {b.day}
                    </td>
                    <td data-label="Next reserved slot">
                      {when(b.nextRequestAt)}
                    </td>
                    <td data-label="Cooldown">
                      {b.cooldownUntil
                        ? when(b.cooldownUntil)
                        : "None recorded"}
                      {b.reason && <p>{b.reason}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </section>
  );
}
