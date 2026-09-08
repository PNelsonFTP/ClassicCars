import { db } from "./db";

export type ServiceBudget = {
  service: string;
  day: string;
  requests: number;
  nextRequestAt: string;
  cooldownUntil?: string;
  reason?: string;
};
export class ServiceBudgetError extends Error {
  readonly kind = "budget";
  constructor(
    message: string,
    readonly retryAfterAt: string,
  ) {
    super(message);
  }
}
const prefix = "service-budget:";
const midnightAfter = (now: number) =>
  new Date(new Date(now).setUTCHours(24, 0, 0, 0)).toISOString();
export async function reserveServiceRequest(
  service: string,
  options: {
    minIntervalMs: number;
    dailyLimit: number;
    maxWaitMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  },
) {
  const clock = options.now || Date.now;
  const sleep =
    options.sleep ||
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const key = prefix + service;
  for (let attempt = 0; attempt < 30; attempt++) {
    const now = clock();
    const day = new Date(now).toISOString().slice(0, 10);
    const row = await db.setting.findUnique({ where: { key } });
    const old: ServiceBudget = row
      ? JSON.parse(row.value)
      : {
          service,
          day,
          requests: 0,
          nextRequestAt: new Date(now).toISOString(),
        };
    const cooldown = Date.parse(old.cooldownUntil || "") || 0;
    if (cooldown > now)
      throw new ServiceBudgetError(
        old.reason || "Provider cooldown is active.",
        new Date(cooldown).toISOString(),
      );
    const used = old.day === day ? old.requests : 0;
    if (used >= options.dailyLimit)
      throw new ServiceBudgetError(
        "Daily request budget reached; no request sent.",
        midnightAfter(now),
      );
    const next = Math.max(now, Date.parse(old.nextRequestAt) || now);
    const wait = next - now;
    if (wait > (options.maxWaitMs ?? 60000))
      throw new ServiceBudgetError(
        "Provider request queue is busy; retry after the reserved interval.",
        new Date(next).toISOString(),
      );
    const value = JSON.stringify({
      service,
      day,
      requests: used + 1,
      nextRequestAt: new Date(
        next + Math.max(0, options.minIntervalMs),
      ).toISOString(),
    } satisfies ServiceBudget);
    let won = false;
    if (row)
      won =
        (
          await db.setting.updateMany({
            where: { key, value: row.value },
            data: { value },
          })
        ).count === 1;
    else {
      try {
        await db.setting.create({ data: { key, value } });
        won = true;
      } catch {}
    }
    if (!won) continue;
    if (wait) await sleep(wait);
    // A concurrent request may have established a restriction while this slot waited.
    const current = await db.setting.findUnique({ where: { key } });
    const state = current ? (JSON.parse(current.value) as ServiceBudget) : null;
    if (state?.cooldownUntil && Date.parse(state.cooldownUntil) > clock())
      throw new ServiceBudgetError(
        state.reason || "Provider cooldown is active.",
        state.cooldownUntil,
      );
    return;
  }
  throw new ServiceBudgetError(
    "Provider request reservation is busy.",
    new Date(clock() + 1000).toISOString(),
  );
}
export async function setServiceCooldown(
  service: string,
  until: string,
  reason: string,
) {
  if (!Number.isFinite(Date.parse(until)))
    throw new Error("Invalid cooldown time");
  const key = prefix + service;
  for (let i = 0; i < 30; i++) {
    const row = await db.setting.findUnique({ where: { key } });
    const now = new Date().toISOString();
    const old: ServiceBudget = row
      ? JSON.parse(row.value)
      : { service, day: now.slice(0, 10), requests: 0, nextRequestAt: now };
    const cooldownUntil =
      Date.parse(old.cooldownUntil || "") > Date.parse(until)
        ? old.cooldownUntil!
        : until;
    const value = JSON.stringify({ ...old, cooldownUntil, reason });
    if (row) {
      if (
        (
          await db.setting.updateMany({
            where: { key, value: row.value },
            data: { value },
          })
        ).count
      )
        return;
    } else {
      try {
        await db.setting.create({ data: { key, value } });
        return;
      } catch {}
    }
  }
  throw new Error("Could not persist provider cooldown");
}
export async function getServiceBudgets(): Promise<ServiceBudget[]> {
  return (
    await db.setting.findMany({ where: { key: { startsWith: prefix } } })
  ).map((row) => JSON.parse(row.value));
}
