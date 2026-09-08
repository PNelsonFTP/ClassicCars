/** Public error contract used by collection and service adapters. */
export type FailureKind =
  | "policy"
  | "access"
  | "layout"
  | "network"
  | "rate-limit"
  | "server"
  | "missing"
  | "budget"
  | "cancelled";
export class FetchFailure extends Error {
  readonly name = "FetchFailure";
  constructor(
    message: string,
    readonly kind: FailureKind,
    readonly httpStatus?: number,
    readonly retryAfterAt?: string,
  ) {
    super(message);
  }
}
export type FailureRecord = {
  kind: FailureKind;
  message: string;
  httpStatus?: number;
  retryAfterAt?: string;
};
export function parseRetryAfter(
  value: unknown,
  now = Date.now(),
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" && typeof raw !== "number") return;
  const text = String(raw).trim();
  if (!text) return;
  const stamp = /^\d+$/.test(text)
    ? now + Number(text) * 1000
    : Date.parse(text);
  if (!Number.isFinite(stamp) || stamp < now || stamp > 8640000000000000)
    return;
  return new Date(stamp).toISOString();
}
export function failureFromResponse(
  status: number,
  headers: Record<string, unknown> = {},
  now = Date.now(),
) {
  return new FetchFailure(
    `Source HTTP ${status}; stopped without bypass.`,
    status === 429
      ? "rate-limit"
      : status === 401 || status === 403
        ? "access"
        : status === 404 || status === 410
          ? "missing"
          : status >= 500
            ? "server"
            : "network",
    status,
    parseRetryAfter(headers["retry-after"] ?? headers["Retry-After"], now),
  );
}
export function classifyFailure(
  error: unknown,
  now = Date.now(),
): FailureRecord {
  if (error instanceof FetchFailure)
    return {
      kind: error.kind,
      message: error.message,
      httpStatus: error.httpStatus,
      retryAfterAt: error.retryAfterAt,
    };
  if (
    error &&
    typeof error === "object" &&
    "kind" in error &&
    error.kind === "budget"
  )
    return {
      kind: "budget",
      message: error instanceof Error ? error.message : String(error),
      retryAfterAt:
        "retryAfterAt" in error && typeof error.retryAfterAt === "string"
          ? error.retryAfterAt
          : undefined,
    };
  const message = error instanceof Error ? error.message : String(error);
  const http = /\bHTTP\s+(\d{3})\b/i.exec(message);
  if (http)
    return classifyFailure(failureFromResponse(Number(http[1]), {}, now), now);
  if (
    /robots|policy|permission|terms|allowlist|Private or reserved|HTTPS URLs|redirect blocked/i.test(
      message,
    )
  )
    return { kind: "policy", message };
  if (
    /challenge|access denied|unavailable template|page unavailable|captcha/i.test(
      message,
    )
  )
    return { kind: "access", message };
  if (
    /timed? out|ENOTFOUND|ECONN|EAI_AGAIN|network|socket|TLS|certificate/i.test(
      message,
    )
  )
    return { kind: "network", message };
  if (/cancel|shutdown requested/i.test(message))
    return { kind: "cancelled", message };
  // Parser exceptions and unexpected content are a layout review, never a zero-stock observation.
  return { kind: "layout", message };
}
