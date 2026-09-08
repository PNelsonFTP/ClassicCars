"use client";
import { useEffect, useState } from "react";
import type { ApiClient, ProvenancePage } from "../shared/api-client";
export default function EvidenceTimeline({
  id,
  api,
  changed,
}: {
  id: string;
  api: ApiClient;
  changed: () => Promise<void>;
}) {
  const [page, setPage] = useState<ProvenancePage | null>(null),
    [offset, setOffset] = useState(0),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState("");
  const load = () =>
    api<ProvenancePage>(
      `/api/listings/${encodeURIComponent(id)}/provenance?offset=${offset}&limit=10`,
    )
      .then(setPage)
      .catch((e) => setMessage(e.message));
  useEffect(() => {
    void load();
  }, [id, offset]);
  async function act(action: string) {
    try {
      await api(`/api/listings/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await changed();
      await load();
      setMessage("Review action recorded.");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <details className="evidence-timeline">
      <summary>Source and review timeline</summary>
      <p>
        Original source claims and private corrections remain separate. Dates
        below describe the recorded evidence.
      </p>
      {page?.override && (
        <p>
          Reviewed {new Date(page.override.reviewedAt).toLocaleString()}:{" "}
          {page.override.reason || "Legacy correction"}
        </p>
      )}
      {page?.source && (
        <div className="two-fields">
          <div>
            <h4>Latest source claims</h4>
            <p>
              Year: {String(page.source.year ?? "Unknown")} ·{" "}
              {String(page.source.specialtyEvidence)}
            </p>
            <pre>{JSON.stringify(page.source.vehicleLocation, null, 2)}</pre>
          </div>
          <div>
            <h4>Current reviewed values</h4>
            <p>
              Year: {String(page.current.year ?? "Unknown")} ·{" "}
              {String(page.current.specialtyEvidence)}
            </p>
            <pre>{JSON.stringify(page.current.vehicleLocation, null, 2)}</pre>
          </div>
        </div>
      )}
      <label className="field-label" htmlFor="review-reset-reason">
        RESET OR GEOCODE RETRY REASON
      </label>
      <textarea
        id="review-reset-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="button-row">
        <button
          className="button secondary"
          disabled={!page?.override || !page.source || reason.trim().length < 5}
          onClick={() => act("review/reset")}
        >
          Restore source values
        </button>
        <button
          className="button secondary"
          disabled={reason.trim().length < 5}
          onClick={() => act("geocode/retry")}
        >
          Invalidate location cache for explicit retry
        </button>
      </div>
      {page?.events.map((e) => (
        <details key={e.id}>
          <summary>
            {e.kind} · {new Date(e.observedAt).toLocaleString()}
          </summary>
          <pre>{JSON.stringify(e.evidence, null, 2)}</pre>
        </details>
      ))}
      <div className="button-row">
        <button
          className="button secondary"
          disabled={!offset}
          onClick={() => setOffset(Math.max(0, offset - 10))}
        >
          Previous evidence
        </button>
        <span>{page?.total ?? 0} recorded events</span>
        <button
          className="button secondary"
          disabled={page?.nextOffset == null}
          onClick={() => setOffset(page!.nextOffset!)}
        >
          Next evidence
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
