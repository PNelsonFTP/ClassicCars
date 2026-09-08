"use client";

import { useEffect, useMemo, useState } from "react";
import type { Listing } from "../shared/schema";
import {
  explainDuplicate,
  rankDuplicateCandidates,
  validateSellerAliases,
  type DuplicateCandidate,
  type DuplicateDecision,
  type DuplicatePage,
  type SellerAlias,
} from "../shared/duplicates";
import { money, storageKey } from "../shared/search";

type ReviewEvent = {
  id: string;
  action: string;
  reason: string;
  createdAt: string;
  selectedIds: string[];
};
type ReviewResponse = DuplicatePage & {
  aliases: SellerAlias[];
  decisions: DuplicateDecision[];
  reviews: ReviewEvent[];
};
type Props = {
  listings: Listing[];
  connected: boolean;
  api: (path: string, options?: RequestInit) => Promise<any>;
  refreshed: () => Promise<void>;
};
const localKey = () =>
  storageKey(process.env.NEXT_PUBLIC_BASE_PATH || "", "snapshot") +
  ":duplicate-review";

export default function DuplicateReview({
  listings,
  connected,
  api,
  refreshed,
}: Props) {
  const [offset, setOffset] = useState(0),
    [includeDismissed, setIncludeDismissed] = useState(false),
    [page, setPage] = useState<ReviewResponse | null>(null);
  const [aliases, setAliases] = useState<SellerAlias[]>([]),
    [decisions, setDecisions] = useState<DuplicateDecision[]>([]),
    [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState(""),
    [acknowledge, setAcknowledge] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  const [query, setQuery] = useState(""),
    [manualLimit, setManualLimit] = useState(40),
    [manualIds, setManualIds] = useState("");
  const [alias, setAlias] = useState(""),
    [canonical, setCanonical] = useState(""),
    [aliasReason, setAliasReason] = useState(""),
    [aliasUrl, setAliasUrl] = useState("");
  useEffect(() => {
    if (connected) return;
    try {
      const state = JSON.parse(localStorage.getItem(localKey()) || "{}");
      setAliases(Array.isArray(state.aliases) ? state.aliases : []);
      setDecisions(Array.isArray(state.decisions) ? state.decisions : []);
    } catch {
      setAliases([]);
      setDecisions([]);
    }
  }, [connected]);
  useEffect(() => {
    if (!connected) return;
    let active = true;
    api(
      `/api/groups/review?offset=${offset}&limit=20&includeDismissed=${includeDismissed}`,
    )
      .then((result: ReviewResponse) => {
        if (active) {
          setPage(result);
          setAliases(result.aliases);
          setDecisions(result.decisions);
          if (result.total && offset >= result.total)
            setOffset(Math.floor((result.total - 1) / 20) * 20);
        }
      })
      .catch((error: Error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [connected, offset, includeDismissed, version, listings, api]);
  const snapshotPage = useMemo(
    () =>
      rankDuplicateCandidates(listings, {
        aliases,
        decisions,
        offset,
        limit: 20,
        includeDismissed,
      }),
    [listings, aliases, decisions, offset, includeDismissed],
  );
  const result = connected ? page : snapshotPage;
  const chosen = useMemo(
    () => listings.filter((l) => selected.includes(l.id)),
    [listings, selected],
  );
  const chosenConflicts = useMemo(
    () =>
      chosen.flatMap((a, i) =>
        chosen
          .slice(i + 1)
          .flatMap((b) =>
            explainDuplicate(a, b, aliases).conflicts.filter((c) =>
              ["identifier", "identity"].includes(c.field),
            ),
          ),
      ),
    [chosen, aliases],
  );
  const selectable = useMemo(() => {
    const text = query.toLowerCase().trim();
    return listings.filter(
      (l) =>
        !text ||
        `${l.id} ${l.title} ${l.sourceName} ${l.seller.name} ${l.stockNumber || ""}`
          .toLowerCase()
          .includes(text),
    );
  }, [listings, query]);
  const saveLocal = (
    nextAliases: SellerAlias[],
    nextDecisions: DuplicateDecision[],
  ) => {
    localStorage.setItem(
      localKey(),
      JSON.stringify({ aliases: nextAliases, decisions: nextDecisions }),
    );
    setAliases(nextAliases);
    setDecisions(nextDecisions);
  };
  async function action(work: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await work();
      setMessage(success);
      setVersion((v) => v + 1);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function selectPair(candidate: DuplicateCandidate) {
    setSelected(candidate.ids);
    setAcknowledge(false);
    document.getElementById("duplicate-review-reason")?.focus();
  }
  async function decide(candidate: DuplicateCandidate) {
    const decision: DuplicateDecision = {
      pairId: candidate.id,
      ids: candidate.ids,
      action: candidate.dismissed ? "restored" : "dismissed",
      reason: reason.trim(),
      reviewedAt: new Date().toISOString(),
    };
    if (connected)
      await api("/api/groups/decision", {
        method: "POST",
        body: JSON.stringify({
          ids: decision.ids,
          action: decision.action,
          reason: decision.reason,
        }),
      });
    else
      saveLocal(aliases, [
        ...decisions.filter((d) => d.pairId !== candidate.id),
        decision,
      ]);
  }
  async function storeAliases(next: SellerAlias[]) {
    const invalid = validateSellerAliases(next);
    if (invalid) throw new Error(invalid);
    if (
      next.some((a) => a.evidenceUrl && !a.evidenceUrl.startsWith("https://"))
    )
      throw new Error("Dealer evidence URLs must use HTTPS.");
    if (connected)
      await api("/api/groups/aliases", {
        method: "PUT",
        body: JSON.stringify({ aliases: next }),
      });
    else saveLocal(next, decisions);
  }
  return (
    <section
      className="panel duplicate-review-v2"
      aria-labelledby="duplicate-review-heading"
    >
      <h2 id="duplicate-review-heading">Cross-listing review</h2>
      <p>
        Compare source evidence before grouping ads. Group counts describe
        linked advertisements and do not establish a count of verified unique
        cars. Generic year/model titles alone are excluded from suggestions.
      </p>
      {!connected && (
        <p className="field-help">
          Connect the local backend for full identifier evidence and reviewed
          merge/undo. Snapshot dismissals and dealer aliases stay in this
          browser.
        </p>
      )}
      <div className="duplicate-review-toolbar">
        <strong>
          {result?.total.toLocaleString() ?? "Loading"} ranked candidates
        </strong>
        <label className="check-label">
          <input
            type="checkbox"
            checked={includeDismissed}
            onChange={(e) => {
              setIncludeDismissed(e.target.checked);
              setOffset(0);
            }}
          />{" "}
          Include dismissed candidates
        </label>
      </div>
      {result?.rows.length === 0 && (
        <p>
          No candidates with enough matching evidence are suggested in this
          view. Missing identifiers and seller detail can hide crossposts;
          manual selection remains available.
        </p>
      )}
      <div className="duplicate-review-candidates">
        {result?.rows.map((candidate) => (
          <article className="duplicate-review-candidate" key={candidate.id}>
            <header>
              <strong>
                {candidate.confidence.replaceAll("-", " ")} · score{" "}
                {candidate.score}
              </strong>
              {candidate.dismissed && <span>Dismissed</span>}
            </header>
            <div className="duplicate-review-pair">
              {candidate.ads.map((ad) => (
                <div key={ad.id}>
                  <a href={ad.url} target="_blank" rel="noreferrer">
                    {ad.title}
                  </a>
                  <strong>
                    {ad.ask == null ? "Ask not established" : money(ad.ask)}
                  </strong>
                  <span>
                    {ad.source} · {ad.seller}
                  </span>
                  <dl>
                    <dt>Identifier</dt>
                    <dd>{ad.identifier || "Not available"}</dd>
                    <dt>Raw stock</dt>
                    <dd>{ad.stock || "Not available"}</dd>
                    <dt>Observed</dt>
                    <dd>{new Date(ad.observedAt).toLocaleString()}</dd>
                  </dl>
                </div>
              ))}
            </div>
            <details>
              <summary>Matching evidence and conflicts</summary>
              <ul>
                {candidate.evidence.map((e) => (
                  <li key={e.field}>
                    {e.explanation} <small>+{e.weight}</small>
                  </li>
                ))}
              </ul>
              {!!candidate.conflicts.length && (
                <div className="duplicate-review-conflicts">
                  <strong>Conflicting source evidence</strong>
                  <ul>
                    {candidate.conflicts.map((c) => (
                      <li key={c.field}>
                        {c.field}: “{c.left}” / “{c.right}”. {c.explanation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </details>
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() => selectPair(candidate)}
              >
                Select these ads
              </button>
              <button
                className="button secondary"
                disabled={busy || reason.trim().length < 3}
                title="Enter the review reason below first"
                onClick={() =>
                  action(
                    () => decide(candidate),
                    candidate.dismissed
                      ? "Candidate restored for review."
                      : "Candidate dismissed; the source ads remain intact.",
                  )
                }
              >
                {candidate.dismissed ? "Undo dismissal" : "Dismiss candidate"}
              </button>
            </div>
          </article>
        ))}
      </div>
      <nav
        className="duplicate-review-toolbar"
        aria-label="Duplicate review pagination"
      >
        <button
          className="button secondary"
          disabled={offset === 0 || busy}
          onClick={() => setOffset(Math.max(0, offset - 20))}
        >
          Previous candidates
        </button>
        <span>
          {result?.total
            ? `${offset + 1}–${Math.min(offset + 20, result.total)} of ${result.total}`
            : "0 candidates"}
        </span>
        <button
          className="button secondary"
          disabled={result?.nextOffset == null || busy}
          onClick={() => setOffset(result?.nextOffset ?? 0)}
        >
          Next candidates
        </button>
      </nav>
      <div className="duplicate-review-selection">
        <h3>Review selected source ads</h3>
        <label htmlFor="duplicate-review-reason">
          Evidence or reason for this review
        </label>
        <textarea
          id="duplicate-review-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe the source documents or differences you reviewed."
          rows={3}
        />
        <p>
          {selected.length} selected. Source prices, observation histories,
          notes and favorites remain attached to their original ads.
        </p>
        {chosen.map((l) => (
          <div className="duplicate-review-selected" key={l.id}>
            <a href={l.url} target="_blank" rel="noreferrer">
              {l.title} · {l.sourceName}
            </a>
            <button
              className="button secondary"
              onClick={() => setSelected(selected.filter((id) => id !== l.id))}
              aria-label={`Remove ${l.id} from merge selection`}
            >
              Remove
            </button>
          </div>
        ))}
        {!!chosenConflicts.length && (
          <div className="duplicate-review-conflicts">
            <p>
              Identifiers or model/year evidence disagree. Resolve the documents
              before recording a reviewed merge.
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={acknowledge}
                onChange={(e) => setAcknowledge(e.target.checked)}
              />{" "}
              I reviewed and explained these conflicting source records.
            </label>
          </div>
        )}
        <button
          className="button primary"
          disabled={
            !connected ||
            busy ||
            selected.length < 2 ||
            reason.trim().length < 3 ||
            (!!chosenConflicts.length && !acknowledge)
          }
          onClick={() =>
            action(async () => {
              await api("/api/groups/merge", {
                method: "POST",
                body: JSON.stringify({
                  ids: selected,
                  reason,
                  acknowledgeIdentifierConflicts: acknowledge,
                }),
              });
              setSelected([]);
              setAcknowledge(false);
              await refreshed();
            }, "Reviewed merge saved. Each source ad and its personal state were preserved.")
          }
        >
          Merge reviewed ads
        </button>
        <details>
          <summary>Select any ads manually</summary>
          <label>
            Search all {listings.length.toLocaleString()} ads
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setManualLimit(40);
              }}
              placeholder="Title, source, dealer, stock or exact ad ID"
            />
          </label>
          <div className="duplicate-review-manual-list">
            {selectable.slice(0, manualLimit).map((l) => (
              <label className="check-label" key={l.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(l.id)}
                  disabled={!selected.includes(l.id) && selected.length >= 100}
                  onChange={(e) => {
                    setSelected(
                      e.target.checked
                        ? [...selected, l.id]
                        : selected.filter((id) => id !== l.id),
                    );
                    setAcknowledge(false);
                  }}
                />
                <span>
                  {l.title} · {l.sourceName}
                  <small>{l.id}</small>
                </span>
              </label>
            ))}
          </div>
          {selectable.length > manualLimit && (
            <button
              className="button secondary"
              onClick={() => setManualLimit(manualLimit + 40)}
            >
              Show 40 more ads
            </button>
          )}
          <label>
            Or paste exact ad IDs, one per line
            <textarea
              rows={3}
              value={manualIds}
              onChange={(e) => setManualIds(e.target.value)}
            />
          </label>
          <button
            className="button secondary"
            onClick={() => {
              const ids = [
                ...new Set(
                  manualIds
                    .split(/\n/)
                    .map((id) => id.trim())
                    .filter(Boolean),
                ),
              ];
              const missing = ids.filter(
                (id) => !listings.some((l) => l.id === id),
              );
              if (missing.length || ids.length > 100)
                setMessage(
                  missing.length
                    ? `Unknown ad IDs: ${missing.join(", ")}`
                    : "Select at most 100 ads per review.",
                );
              else {
                setSelected(ids);
                setAcknowledge(false);
              }
            }}
          >
            Use these ad IDs
          </button>
        </details>
      </div>
      <details className="duplicate-review-aliases">
        <summary>Reviewed dealer aliases ({aliases.length})</summary>
        <p>
          Only add names you have established refer to the same dealer. Aliases
          help rank suggestions and never trigger an automatic merge. Raw seller
          names stay visible.
        </p>
        {aliases.map((a) => (
          <div key={a.alias} className="duplicate-review-selected">
            <span>
              {a.alias} → {a.canonical}
              <small>
                {a.reason} · {new Date(a.reviewedAt).toLocaleDateString()}
              </small>
            </span>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                action(
                  () =>
                    storeAliases(
                      aliases.filter((item) => item.alias !== a.alias),
                    ),
                  "Dealer alias removed.",
                )
              }
            >
              Remove alias
            </button>
          </div>
        ))}
        <div className="duplicate-review-alias-form">
          <label>
            Advertised dealer name
            <input value={alias} onChange={(e) => setAlias(e.target.value)} />
          </label>
          <label>
            Canonical dealer name
            <input
              value={canonical}
              onChange={(e) => setCanonical(e.target.value)}
            />
          </label>
          <label>
            Review reason
            <input
              value={aliasReason}
              onChange={(e) => setAliasReason(e.target.value)}
            />
          </label>
          <label>
            Evidence URL (optional)
            <input
              type="url"
              value={aliasUrl}
              onChange={(e) => setAliasUrl(e.target.value)}
              placeholder="https://"
            />
          </label>
        </div>
        <button
          className="button secondary"
          disabled={
            busy ||
            alias.trim().length < 2 ||
            canonical.trim().length < 2 ||
            aliasReason.trim().length < 3
          }
          onClick={() =>
            action(async () => {
              await storeAliases([
                ...aliases,
                {
                  alias: alias.trim(),
                  canonical: canonical.trim(),
                  reason: aliasReason.trim(),
                  reviewedAt: new Date().toISOString(),
                  ...(aliasUrl.trim() ? { evidenceUrl: aliasUrl.trim() } : {}),
                },
              ]);
              setAlias("");
              setCanonical("");
              setAliasReason("");
              setAliasUrl("");
            }, "Reviewed dealer alias saved.")
          }
        >
          Save dealer alias
        </button>
      </details>
      {connected && (
        <details>
          <summary>Merge review history ({page?.reviews.length ?? 0})</summary>
          <p>
            Undo removes that review's link and recomputes the remaining links.
            Later reviewed relationships remain in effect.
          </p>
          {page?.reviews.map((review) => (
            <div className="duplicate-review-selected" key={review.id}>
              <span>
                {review.reason}
                <small>
                  {review.selectedIds.length} selected ads ·{" "}
                  {new Date(review.createdAt).toLocaleString()} ·{" "}
                  {review.action === "merge" ? "Active" : "Undone"}
                </small>
              </span>
              {review.action === "merge" && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      await api("/api/groups/unmerge", {
                        method: "POST",
                        body: JSON.stringify({ groupId: review.id }),
                      });
                      await refreshed();
                    }, "Review reversed; remaining links and all original ad data preserved.")
                  }
                >
                  Undo this merge review
                </button>
              )}
            </div>
          ))}
        </details>
      )}
      {message && (
        <p className="field-help" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
