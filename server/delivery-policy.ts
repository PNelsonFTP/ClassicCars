import { createHash } from "node:crypto";
export const DELIVERY_MAX_ATTEMPTS = 6;
export const SMTP_TIMEOUTS = {
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  dnsTimeout: 10000,
} as const;
export function deliveryBatchId(channel: string, attemptIds: string[]) {
  return createHash("sha256")
    .update(JSON.stringify({ channel, ids: [...attemptIds].sort() }))
    .digest("hex");
}
export function smtpTransportOptions(value: string) {
  const url = new URL(value);
  if (!["smtp:", "smtps:"].includes(url.protocol) || !url.hostname)
    throw new Error("SMTP must be a configured smtp:// or smtps:// URL.");
  // Parse only known URL fields. A query parameter cannot override safety/time bounds.
  return {
    host: url.hostname,
    port: Number(url.port || (url.protocol === "smtps:" ? 465 : 587)),
    secure: url.protocol === "smtps:",
    requireTLS: url.protocol !== "smtps:",
    auth: url.username
      ? {
          user: decodeURIComponent(url.username),
          pass: decodeURIComponent(url.password),
        }
      : undefined,
    ...SMTP_TIMEOUTS,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}
export function deliveryFailure(
  error: unknown,
  attempts: number,
  now = Date.now(),
) {
  const e = error as {
    code?: string;
    responseCode?: number;
    statusCode?: number;
    uncertain?: boolean;
    message?: string;
  };
  const status = e.statusCode ?? e.responseCode;
  const uncertain =
    !!e.uncertain ||
    /timed? out|timeout/i.test(e.message ?? "") ||
    ["ETIMEDOUT", "ESOCKET", "ECONNRESET", "EPIPE"].includes(e.code ?? "");
  const permanent =
    (!!e.statusCode &&
      e.statusCode >= 400 &&
      e.statusCode < 500 &&
      ![408, 425, 429].includes(e.statusCode)) ||
    e.code === "EAUTH" ||
    (!!e.responseCode && e.responseCode >= 500);
  const deadLetter = attempts >= DELIVERY_MAX_ATTEMPTS || permanent;
  return {
    status: uncertain ? "uncertain" : deadLetter ? "failed" : "retry",
    error: uncertain
      ? "Delivery outcome is uncertain. The destination may have accepted the message. Review its receipt before explicitly retrying; the same deduplication key will be reused."
      : permanent
        ? `Destination rejected delivery${status ? ` (${status})` : ""}. Correct configuration and manually retry.`
        : deadLetter
          ? "Delivery exhausted six bounded attempts. Review configuration and manually retry."
          : `Temporary delivery failure${status ? ` (${status})` : e.code ? ` (${String(e.code).replace(/[^A-Z0-9_]/g, "")})` : ""}; a bounded retry is scheduled.`,
    nextAttemptAt: new Date(
      now + Math.min(864e5, 60000 * 2 ** Math.max(0, attempts - 1)),
    ),
  };
}
