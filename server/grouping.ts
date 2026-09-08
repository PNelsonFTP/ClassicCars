import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import { listingSchema, type Listing } from "../shared/schema";
import {
  explainDuplicate,
  identifierConflicts,
  pairId,
  rankDuplicateCandidates,
  validateSellerAliases,
  type DuplicateDecision,
  type SellerAlias,
} from "../shared/duplicates";

type GroupEvent = {
  id: string;
  action: string;
  listingIds: string;
  createdAt: Date;
};
type MergePayload = {
  version: 2;
  selectedIds: string[];
  before: { id: string; groupId: string | null }[];
  acknowledgedIdentifierConflicts: boolean;
};
const BASE = "grouping-base-v1",
  ALIASES = "seller-aliases-v1",
  DECISIONS = "duplicate-decisions-v1";
function fail(message: string, statusCode = 409): never {
  throw Object.assign(new Error(message), { statusCode });
}
function selectedIds(event: GroupEvent): string[] {
  const payload = JSON.parse(event.listingIds);
  return Array.isArray(payload)
    ? payload.map((x: { id: string }) => x.id)
    : (payload.selectedIds ?? []);
}

/** Replay active review edges over stable source-evidence groups; undo order cannot restore obsolete groups. */
export function reconcileGroups(
  listings: Pick<Listing, "id" | "groupId">[],
  base: Record<string, string | null>,
  events: GroupEvent[],
): Map<string, string | null> {
  const parents = new Map(listings.map((l) => [l.id, l.id]));
  const find = (id: string): string => {
    const p = parents.get(id)!;
    if (p === id) return p;
    const root = find(p);
    parents.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    if (!parents.has(a) || !parents.has(b)) return;
    const x = find(a),
      y = find(b);
    if (x !== y) parents.set(y, x);
  };
  const baseLeaders = new Map<string, string>();
  for (const l of listings)
    if (base[l.id]) {
      const group = base[l.id]!;
      const first = baseLeaders.get(group);
      if (first) union(first, l.id);
      else baseLeaders.set(group, l.id);
    }
  const active = events
    .filter((e) => e.action === "merge")
    .sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
  for (const event of active) {
    const ids = selectedIds(event).filter((id) => parents.has(id));
    for (const id of ids.slice(1)) union(ids[0], id);
  }
  const names = new Map<string, string>();
  for (const event of active) {
    const id = selectedIds(event).find((x) => parents.has(x));
    if (id && !names.has(find(id))) names.set(find(id), event.id);
  }
  for (const l of listings)
    if (base[l.id] && !names.has(find(l.id)))
      names.set(find(l.id), base[l.id]!);
  return new Map(listings.map((l) => [l.id, names.get(find(l.id)) ?? null]));
}
async function rawListings(tx: Prisma.TransactionClient) {
  return (await tx.listing.findMany()).map((r) =>
    listingSchema.parse(JSON.parse(r.payload)),
  );
}
async function baseGroups(
  tx: Prisma.TransactionClient,
  listings: Listing[],
  events: GroupEvent[],
) {
  const record = await tx.setting.findUnique({ where: { key: BASE } });
  const base: Record<string, string | null> = record
    ? JSON.parse(record.value)
    : Object.fromEntries(listings.map((l) => [l.id, l.groupId]));
  if (!record) {
    // Migrate existing reviewed history once, backwards, without deleting any history rows.
    for (const event of [...events].sort(
      (a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime() ||
        b.id.localeCompare(a.id),
    )) {
      const payload = JSON.parse(event.listingIds),
        before = Array.isArray(payload) ? payload : payload.before;
      for (const item of before ?? [])
        if (base[item.id] === event.id) base[item.id] = item.groupId;
    }
  }
  for (const l of listings)
    if (!(l.id in base))
      base[l.id] = l.groupId?.startsWith("reviewed:") ? null : l.groupId;
  // Ingestion can establish or detach automatic groups after the first review.
  // Refresh their baseline; only active reviewed groups need historical membership.
  for (const l of listings)
    if (!l.groupId?.startsWith("reviewed:")) base[l.id] = l.groupId;
  // A manual review can temporarily cover an older automatic group. If fresh
  // source evidence now contradicts that old relation, undo must not resurrect it.
  const automatic = new Map<string, Listing[]>();
  for (const l of listings)
    if (base[l.id]?.startsWith("vehicle:")) {
      const rows = automatic.get(base[l.id]!);
      if (rows) rows.push(l);
      else automatic.set(base[l.id]!, [l]);
    }
  for (const rows of automatic.values())
    if (
      rows.some((a, i) =>
        rows
          .slice(i + 1)
          .some(
            (b) =>
              a.model !== b.model ||
              a.year !== b.year ||
              identifierConflicts(a, b).length > 0,
          ),
      )
    )
      for (const l of rows) base[l.id] = null;
  await tx.setting.upsert({
    where: { key: BASE },
    create: { key: BASE, value: JSON.stringify(base) },
    update: { value: JSON.stringify(base) },
  });
  return base;
}
async function applyGroups(
  tx: Prisma.TransactionClient,
  listings: Listing[],
  base: Record<string, string | null>,
  events: GroupEvent[],
) {
  const assignments = reconcileGroups(listings, base, events);
  const changed: string[] = [];
  for (const l of listings) {
    const groupId = assignments.get(l.id) ?? null;
    if (l.groupId === groupId) continue;
    await tx.listing.update({
      where: { id: l.id },
      data: { groupId, payload: JSON.stringify({ ...l, groupId }) },
    });
    changed.push(l.id);
  }
  return changed;
}
export async function mergeReviewedGroups(input: {
  ids: string[];
  reason: string;
  acknowledgeIdentifierConflicts?: boolean;
}) {
  const body = z
    .object({
      ids: z.array(z.string()).min(2).max(100),
      reason: z.string().trim().min(3).max(2000),
      acknowledgeIdentifierConflicts: z.boolean().default(false),
    })
    .parse(input);
  const ids = [...new Set(body.ids)];
  if (ids.length < 2) fail("Select at least two different source ads.", 400);
  return db.$transaction(
    async (tx) => {
      const listings = await rawListings(tx),
        byId = new Map(listings.map((l) => [l.id, l]));
      if (ids.some((id) => !byId.has(id)))
        fail("A selected source ad no longer exists; reload the review.", 404);
      const selectedGroups = new Set(
        ids.map((id) => byId.get(id)!.groupId).filter(Boolean),
      );
      const affected = listings.filter(
        (l) =>
          ids.includes(l.id) || (l.groupId && selectedGroups.has(l.groupId)),
      );
      if (new Set(affected.map((l) => l.groupId || l.id)).size < 2)
        fail("These ads are already in the same group.");
      const conflicts = affected.flatMap((a, i) =>
        affected
          .slice(i + 1)
          .flatMap((b) =>
            identifierConflicts(a, b).map((c) => ({ ids: [a.id, b.id], ...c })),
          ),
      );
      if (conflicts.length && !body.acknowledgeIdentifierConflicts)
        fail(
          "Source identifiers conflict. Review both documents and explicitly acknowledge the conflict before a manual merge.",
        );
      const events = await tx.groupReview.findMany({
        where: { action: { in: ["merge", "unmerged"] } },
        orderBy: { createdAt: "asc" },
      });
      const base = await baseGroups(tx, listings, events),
        id = `reviewed:${randomUUID()}`;
      const payload: MergePayload = {
        version: 2,
        selectedIds: ids,
        before: affected.map((l) => ({ id: l.id, groupId: l.groupId })),
        acknowledgedIdentifierConflicts: body.acknowledgeIdentifierConflicts,
      };
      const event = await tx.groupReview.create({
        data: {
          id,
          listingIds: JSON.stringify(payload),
          action: "merge",
          reason: body.reason,
        },
      });
      const changedIds = await applyGroups(tx, listings, base, [
        ...events,
        event,
      ]);
      const groupId = reconcileGroups(listings, base, [...events, event]).get(
        ids[0],
      );
      return {
        groupId,
        reviewId: id,
        affectedIds: affected.map((l) => l.id),
        changedIds,
        conflicts,
      };
    },
    { timeout: 20000 },
  );
}
export async function unmergeReviewedGroup(groupId: string) {
  return db.$transaction(
    async (tx) => {
      const review = await tx.groupReview.findUnique({
        where: { id: groupId },
      });
      if (!review || !["merge", "unmerged"].includes(review.action))
        fail("This is not a reversible reviewed merge.", 404);
      if (review.action === "unmerged")
        return { ok: true, changedIds: [], alreadyUndone: true };
      const listings = await rawListings(tx),
        events = await tx.groupReview.findMany({
          where: { action: { in: ["merge", "unmerged"] } },
          orderBy: { createdAt: "asc" },
        });
      const base = await baseGroups(tx, listings, events);
      await tx.groupReview.update({
        where: { id: groupId },
        data: { action: "unmerged" },
      });
      const changedIds = await applyGroups(
        tx,
        listings,
        base,
        events.map((e) =>
          e.id === groupId ? { ...e, action: "unmerged" } : e,
        ),
      );
      await tx.groupReview.create({
        data: {
          id: `undo:${randomUUID()}`,
          action: "merge-undo",
          reason: `User reversed reviewed merge ${groupId}; remaining review edges replayed.`,
          listingIds: JSON.stringify({ reviewId: groupId, changedIds }),
        },
      });
      return { ok: true, changedIds, alreadyUndone: false };
    },
    { timeout: 20000 },
  );
}
export async function getDuplicateContext() {
  const records = await db.setting.findMany({
    where: { key: { in: [ALIASES, DECISIONS] } },
  });
  return {
    aliases: JSON.parse(
      records.find((r) => r.key === ALIASES)?.value ?? "[]",
    ) as SellerAlias[],
    decisions: JSON.parse(
      records.find((r) => r.key === DECISIONS)?.value ?? "[]",
    ) as DuplicateDecision[],
  };
}
/** User dismissals/reversed review links must not be silently recreated by ingestion. */
export async function blockedAutomaticPairs() {
  const context = await getDuplicateContext();
  const blocked = new Set(
    context.decisions
      .filter((d) => d.action === "dismissed")
      .map((d) => d.pairId),
  );
  for (const review of await db.groupReview.findMany({
    where: { action: "unmerged" },
  })) {
    const ids = selectedIds(review);
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        blocked.add(pairId(ids[i], ids[j]));
  }
  return blocked;
}
export async function duplicateReviewPage(
  listings: Listing[],
  options: { offset?: number; limit?: number; includeDismissed?: boolean } = {},
) {
  const context = await getDuplicateContext();
  const reviews = await db.groupReview.findMany({
    where: { action: { in: ["merge", "unmerged"] } },
    orderBy: { createdAt: "desc" },
  });
  return {
    ...rankDuplicateCandidates(listings, { ...context, ...options }),
    ...context,
    reviews: reviews.map((r) => ({
      id: r.id,
      action: r.action,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
      selectedIds: selectedIds(r),
    })),
  };
}
export async function reviewDuplicateDecision(input: {
  ids: string[];
  action: "dismissed" | "restored";
  reason: string;
}) {
  const body = z
    .object({
      ids: z.array(z.string()).length(2),
      action: z.enum(["dismissed", "restored"]),
      reason: z.string().trim().min(3).max(2000),
    })
    .parse(input);
  const ids = [...body.ids].sort() as [string, string];
  if (ids[0] === ids[1])
    fail("A duplicate review requires different ads.", 400);
  return db.$transaction(async (tx) => {
    if ((await tx.listing.count({ where: { id: { in: ids } } })) !== 2)
      fail("Unknown source ad in duplicate review.", 404);
    const record = await tx.setting.findUnique({ where: { key: DECISIONS } }),
      decisions: DuplicateDecision[] = JSON.parse(record?.value ?? "[]");
    const decision: DuplicateDecision = {
      pairId: pairId(...ids),
      ids,
      action: body.action,
      reason: body.reason,
      reviewedAt: new Date().toISOString(),
    };
    const value = JSON.stringify([
      ...decisions.filter((d) => d.pairId !== decision.pairId),
      decision,
    ]);
    await tx.setting.upsert({
      where: { key: DECISIONS },
      create: { key: DECISIONS, value },
      update: { value },
    });
    await tx.groupReview.create({
      data: {
        id: `decision:${randomUUID()}`,
        listingIds: JSON.stringify(ids),
        action: `duplicate-${body.action}`,
        reason: body.reason,
      },
    });
    return decision;
  });
}
export async function saveSellerAliases(input: SellerAlias[]) {
  const aliases = z
    .array(
      z.object({
        alias: z.string().trim().min(2).max(200),
        canonical: z.string().trim().min(2).max(200),
        reason: z.string().trim().min(3).max(2000),
        reviewedAt: z.string().datetime(),
        evidenceUrl: z.string().url().startsWith("https://").optional(),
      }),
    )
    .max(500)
    .parse(input);
  const invalid = validateSellerAliases(aliases);
  if (invalid) fail(invalid, 400);
  await db.$transaction(async (tx) => {
    const old = await tx.setting.findUnique({ where: { key: ALIASES } });
    await tx.setting.upsert({
      where: { key: ALIASES },
      create: { key: ALIASES, value: JSON.stringify(aliases) },
      update: { value: JSON.stringify(aliases) },
    });
    await tx.groupReview.create({
      data: {
        id: `aliases:${randomUUID()}`,
        action: "seller-aliases",
        listingIds: JSON.stringify({
          previous: JSON.parse(old?.value ?? "[]"),
          next: aliases,
        }),
        reason:
          "User saved the auditable dealer alias registry; aliases affect review suggestions only.",
      },
    });
  });
  return { aliases };
}
export { explainDuplicate };
