"use client";
import { useState } from "react";
import type { ApiClient } from "../shared/api-client";
export type DeliveryAttemptView = {
  id: string;
  channel: string;
  status: string;
  attempts: number;
  error: string | null;
  nextAttemptAt?: string;
};
export default function DeliveryAttempts({
  attempts,
  api,
  refresh,
}: {
  attempts: DeliveryAttemptView[];
  api: ApiClient;
  refresh: () => Promise<void>;
}) {
  const [offset, setOffset] = useState(0);
  return (
    <div className="panel">
      <h2>Alert delivery</h2>
      <p>
        Delivery requires an opted-in search channel, enabled settings and a
        configured destination. Retry retains the original digest and receiver
        deduplication key.
      </p>
      {!attempts.length ? (
        <p>No external delivery attempts.</p>
      ) : (
        attempts
          .slice(offset, offset + 10)
          .map((a) => (
            <Attempt key={a.id} attempt={a} api={api} refresh={refresh} />
          ))
      )}
      {attempts.length > 10 && (
        <div className="button-row">
          <button
            className="button secondary"
            disabled={!offset}
            onClick={() => setOffset((n) => n - 10)}
          >
            Previous deliveries
          </button>
          <button
            className="button secondary"
            disabled={offset + 10 >= attempts.length}
            onClick={() => setOffset((n) => n + 10)}
          >
            Next deliveries
          </button>
        </div>
      )}
    </div>
  );
}
function Attempt({
  attempt: a,
  api,
  refresh,
}: {
  attempt: DeliveryAttemptView;
  api: ApiClient;
  refresh: () => Promise<void>;
}) {
  const [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <div className="evidence-row">
      <strong>
        {a.channel} · {a.status}
      </strong>
      <p>
        {a.attempts} attempts{a.error ? ` · ${a.error}` : ""}
      </p>
      {a.status === "retry" && a.nextAttemptAt && (
        <p>Next attempt: {new Date(a.nextAttemptAt).toLocaleString()}</p>
      )}
      {a.status === "uncertain" && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
          I checked the destination; retrying may deliver a duplicate.
        </label>
      )}
      {["blocked", "failed", "retry", "uncertain"].includes(a.status) && (
        <button
          className="button secondary"
          disabled={busy || (a.status === "uncertain" && !ack)}
          onClick={async () => {
            setBusy(true);
            try {
              await api(
                `/api/delivery-attempts/${encodeURIComponent(a.id)}/retry`,
                {
                  method: "POST",
                  body: JSON.stringify({ acknowledgeUncertain: ack }),
                },
              );
              await refresh();
              setMessage("Original digest queued again.");
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Retry digest
        </button>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
