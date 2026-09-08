import { db } from "./db";
import { getSettings, getWorkspace } from "./store";
import type { Search } from "../shared/schema";
import { searchPageFromBatches } from "./search-page-core";
export async function searchPage(
  filters: Search,
  offset = 0,
  limit = 48,
  now = Date.now(),
) {
  const [settings, { workspace }] = await Promise.all([
    getSettings(),
    getWorkspace(),
  ]);
  async function* batches() {
    // These filters are unconditional AND predicates in every mode and use existing indexed columns.
    if (filters.favoritesOnly && workspace.favorites.length === 0) {
      yield [];
      return;
    }
    const where = {
      ...(filters.sources.length ? { sourceId: { in: filters.sources } } : {}),
      ...(filters.favoritesOnly && workspace.favorites.length <= 500
        ? { id: { in: workspace.favorites } }
        : {}),
    };
    let cursor: string | undefined;
    while (true) {
      const rows = await db.listing.findMany({
        where,
        orderBy: { id: "asc" },
        take: 500,
        select: { id: true, payload: true },
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      yield rows;
      if (rows.length < 500) break;
      cursor = rows.at(-1)!.id;
    }
  }
  return searchPageFromBatches(filters, offset, limit, {
    batches: batches(),
    workspace,
    staleDays: settings.staleDays,
    auctionMaxAgeHours: settings.auctionMaxAgeHours,
    now,
  });
}
