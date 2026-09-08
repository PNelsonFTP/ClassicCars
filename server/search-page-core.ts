import {
  listingSchema,
  type Listing,
  type Search,
  type Workspace,
} from "../shared/schema";
import { matches, searchListings } from "../shared/search";
import { projectFreshness } from "../shared/freshness";
import type { SearchPage } from "../shared/api-client";
export type SearchPageInput = {
  batches: AsyncIterable<readonly { payload: string }[]>;
  workspace: Workspace;
  staleDays: number;
  auctionMaxAgeHours: number;
  now?: number;
};
/** The API and national benchmark share this bounded database-read boundary and one operation clock. */
export async function searchPageFromBatches(
  filters: Search,
  offset: number,
  limit: number,
  input: SearchPageInput,
): Promise<SearchPage> {
  const now = input.now ?? Date.now(),
    matching: Listing[] = [];
  const start = Math.max(0, Math.floor(offset)),
    take = Math.max(1, Math.min(200, Math.floor(limit)));
  for await (const rows of input.batches)
    for (const row of rows) {
      const listing = projectFreshness(
        listingSchema.parse(JSON.parse(row.payload)),
        input.staleDays,
        now,
        input.auctionMaxAgeHours,
      );
      if (matches(listing, filters, input.workspace, now))
        matching.push(listing);
    }
  const result = searchListings(matching, filters, input.workspace, now),
    rows = result.rows.slice(start, start + take);
  return {
    ...result,
    rows,
    total: result.rows.length,
    offset: start,
    nextOffset:
      start + rows.length < result.rows.length ? start + rows.length : null,
  };
}
