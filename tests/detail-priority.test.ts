import { it, expect } from "vitest";
import { listingSchema } from "../shared/schema";
import { prioritizeDetails } from "../server/ingest/detail-priority";
import type { DetailTask } from "../server/ingest/operations";
it("prioritizes favorites and incomplete data while reserving each fourth slot for oldest work", () => {
  const tasks: DetailTask[] = Array.from({ length: 8 }, (_, i) => ({
    listingId: String(i),
    url: `https://example.com/${i}`,
    scopes: ["regional"],
    queryIds: ["q"],
    discoveredAt: "2026-10-21T00:00:00Z",
    status: "pending",
    attempts: 0,
    nextAttemptAt: null,
  }));
  const listings = new Map(
    tasks.map((t) => [
      t.listingId,
      listingSchema.parse({
        id: t.listingId,
        sourceId: "fixture",
        sourceListingId: t.listingId,
        sourceName: "Fixture",
        title: "1969 Camaro",
        url: t.url,
        seller: { name: "Fixture" },
        firstSeenAt: t.discoveredAt,
        lastObservedAt: t.discoveredAt,
      }),
    ]),
  );
  const order = prioritizeDetails(tasks, listings, ["4", "5", "6", "7"]);
  expect(order.slice(0, 4).map((t) => t.listingId)).toEqual([
    "4",
    "5",
    "6",
    "0",
  ]);
  expect(new Set(order.map((t) => t.listingId)).size).toBe(8);
  expect(tasks[0].listingId).toBe("0");
});
