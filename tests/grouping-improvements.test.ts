import { beforeAll, afterAll, describe, expect, it } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { listingSchema } from "../shared/schema";
const folder = mkdtempSync(join(tmpdir(), "musclescout-identity-db-"));
process.env.DATABASE_URL = `file:${folder}/test.db`;
let grouping: typeof import("../server/grouping"),
  db: (typeof import("../server/db"))["db"];
const stamp = "2026-09-08T00:00:00Z";
const car = (id: string, extra: Record<string, unknown> = {}) =>
  listingSchema.parse({
    id,
    sourceListingId: id,
    sourceId: "fixture",
    sourceName: "Fixture Gallery",
    url: "https://example.com/" + id,
    title: "1969 Chevrolet Camaro",
    year: 1969,
    model: "Camaro",
    seller: { name: "Fixture Gallery", type: "dealer" },
    firstSeenAt: stamp,
    lastObservedAt: stamp,
    ...extra,
  });
async function insert(id: string, extra: Record<string, unknown> = {}) {
  const l = car(id, extra);
  await db.listing.create({
    data: {
      id,
      sourceId: l.sourceId,
      sourceListingId: id,
      model: l.model,
      year: l.year,
      askingPrice: l.askingPrice,
      availability: l.availability,
      saleType: l.saleType,
      groupId: l.groupId,
      firstSeenAt: new Date(stamp),
      lastObservedAt: new Date(stamp),
      payload: JSON.stringify(l),
    },
  });
}
beforeAll(async () => {
  const Database = createRequire(import.meta.url)("better-sqlite3"),
    sqlite = new Database(`${folder}/test.db`);
  const root = process.env.MUSCLESCOUT_TEST_PROJECT ?? process.cwd();
  for (const dir of readdirSync(join(root, "prisma/migrations")).sort()) {
    const sql = join(root, "prisma/migrations", dir, "migration.sql");
    if (existsSync(sql)) sqlite.exec(readFileSync(sql, "utf8"));
  }
  sqlite.close();
  ({ db } = await import("../server/db"));
  grouping = await import("../server/grouping");
});
afterAll(async () => {
  await db?.$disconnect();
  rmSync(folder, { recursive: true, force: true });
});
describe("review event replay and personal-data invariants", () => {
  it("safely undoes overlapping merges out of order while retaining histories and workspace", async () => {
    for (const id of ["a", "b", "c", "d"]) await insert(id);
    await db.workspace.create({
      data: {
        id: "personal",
        payload: JSON.stringify({
          favorites: ["a", "c"],
          notes: { a: "Keep original note", b: "Different ad note" },
        }),
      },
    });
    await db.observation.create({
      data: {
        listingId: "a",
        kind: "ask",
        amount: 30000,
        observedAt: new Date(stamp),
        payload: "Original source observation",
      },
    });
    const workspace = await db.workspace.findUnique({
        where: { id: "personal" },
      }),
      observations = await db.observation.findMany();
    const ab = await grouping.mergeReviewedGroups({
      ids: ["a", "b"],
      reason: "Reviewed pair A/B",
    });
    const bc = await grouping.mergeReviewedGroups({
      ids: ["b", "c"],
      reason: "Reviewed pair B/C",
    });
    expect(bc.affectedIds.sort()).toEqual(["a", "b", "c"]);
    expect(
      (
        await db.listing.findMany({ where: { id: { in: ["a", "b", "c"] } } })
      ).every((l) => l.groupId === ab.groupId),
    ).toBe(true);
    await grouping.unmergeReviewedGroup(ab.reviewId);
    expect(
      (await db.listing.findUnique({ where: { id: "a" } }))?.groupId,
    ).toBeNull();
    expect((await db.listing.findUnique({ where: { id: "b" } }))?.groupId).toBe(
      bc.reviewId,
    );
    expect((await db.listing.findUnique({ where: { id: "c" } }))?.groupId).toBe(
      bc.reviewId,
    );
    await grouping.unmergeReviewedGroup(bc.reviewId);
    expect((await db.listing.findMany()).every((l) => l.groupId == null)).toBe(
      true,
    );
    expect(await grouping.unmergeReviewedGroup(bc.reviewId)).toMatchObject({
      alreadyUndone: true,
    });
    expect(
      await db.workspace.findUnique({ where: { id: "personal" } }),
    ).toEqual(workspace);
    expect(await db.observation.findMany()).toEqual(observations);
    expect(await db.listing.count()).toBe(4);
    expect([...(await grouping.blockedAutomaticPairs())]).toEqual(
      expect.arrayContaining(['["a","b"]', '["b","c"]']),
    );
  });
  it("replays all six undo orders without resurrecting inactive merge edges", () => {
    const listings = ["a", "b", "c", "d"].map((id) => ({ id, groupId: null })),
      base = Object.fromEntries(listings.map((l) => [l.id, null]));
    const events = [
      ["a", "b"],
      ["b", "c"],
      ["c", "d"],
    ].map((ids, i) => ({
      id: `reviewed:${i}`,
      action: "merge",
      createdAt: new Date(Date.parse(stamp) + i),
      listingIds: JSON.stringify({ version: 2, selectedIds: ids, before: [] }),
    }));
    for (const order of [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ]) {
      const current = events.map((e) => ({ ...e }));
      for (const index of order) {
        current[index].action = "unmerged";
        const assignments = grouping.reconcileGroups(listings, base, current);
        for (let edge = 0; edge < 3; edge++) {
          const a = assignments.get(listings[edge].id),
            b = assignments.get(listings[edge + 1].id);
          expect(a != null && a === b).toBe(current[edge].action === "merge");
        }
      }
      expect([
        ...grouping.reconcileGroups(listings, base, current).values(),
      ]).toEqual([null, null, null, null]);
    }
  });
  it("refuses identifier conflicts unless explicitly acknowledged for a reviewed merge", async () => {
    await insert("conflict-a", { identifier: "12345678" });
    await insert("conflict-b", { identifier: "98765432" });
    await expect(
      grouping.mergeReviewedGroups({
        ids: ["conflict-a", "conflict-b"],
        reason: "Review candidate",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    const result = await grouping.mergeReviewedGroups({
      ids: ["conflict-a", "conflict-b"],
      reason: "Reviewed contradictory source documents, dealer corrected typo",
      acknowledgeIdentifierConflicts: true,
    });
    expect(result.conflicts).toHaveLength(1);
    await grouping.unmergeReviewedGroup(result.reviewId);
  });
  it("persists dismissal and undo with a review audit and validates alias cycles", async () => {
    await grouping.reviewDuplicateDecision({
      ids: ["a", "b"],
      action: "dismissed",
      reason: "Inspected different interior details",
    });
    expect((await grouping.getDuplicateContext()).decisions[0].action).toBe(
      "dismissed",
    );
    expect((await grouping.blockedAutomaticPairs()).has('["a","b"]')).toBe(
      true,
    );
    await grouping.reviewDuplicateDecision({
      ids: ["b", "a"],
      action: "restored",
      reason: "New evidence merits another review",
    });
    expect((await grouping.getDuplicateContext()).decisions).toHaveLength(1);
    expect((await grouping.getDuplicateContext()).decisions[0].action).toBe(
      "restored",
    );
    expect(
      await db.groupReview.count({
        where: { action: { startsWith: "duplicate-" } },
      }),
    ).toBe(2);
    await expect(
      grouping.saveSellerAliases([
        {
          alias: "Dealer A",
          canonical: "Dealer B",
          reason: "Test cycle",
          reviewedAt: stamp,
        },
        {
          alias: "Dealer B",
          canonical: "Dealer A",
          reason: "Test cycle",
          reviewedAt: stamp,
        },
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
