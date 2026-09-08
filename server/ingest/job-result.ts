/** A returned provider result is not proof that requested geography work succeeded. */
export function serviceJobCompletion(
  result: unknown,
  stopped = false,
  now = Date.now(),
) {
  if (stopped)
    return {
      state: "interrupted" as const,
      nextRunAt: new Date(now + 10000).toISOString(),
      note: "Shutdown interrupted the bounded service pass; remaining work is retained.",
    };
  if (!result || typeof result !== "object")
    return {
      state: "partial" as const,
      nextRunAt: null,
      note: "Service returned no verifiable result; manual review is required.",
    };
  const value = result as {
    reason?: unknown;
    remaining?: unknown;
    reviewNeeded?: unknown;
    errors?: unknown;
  };
  const count = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0;
  const errors = Array.isArray(value.errors) ? value.errors.length : 0;
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  if (
    reason ||
    count(value.remaining) > 0 ||
    count(value.reviewNeeded) > 0 ||
    errors > 0
  )
    return {
      state: "partial" as const,
      nextRunAt: null,
      note:
        reason ||
        `${count(value.remaining)} items remain, ${count(value.reviewNeeded)} require review and ${errors} failed. Another service pass requires an explicit retry.`,
    };
  return {
    state: "completed" as const,
    nextRunAt: null,
    note: "The bounded service result reports no remaining work or failures.",
  };
}
