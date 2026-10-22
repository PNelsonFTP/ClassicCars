import { readFile, stat } from "node:fs/promises";
import { travelAtlasSchema, type TravelAtlas } from "../shared/travel-contract";
import { projectTravel } from "../shared/travel";
import type { Listing } from "../shared/schema";
let cached:
  { file: string; mtime: number; size: number; atlas: TravelAtlas } | undefined;
export async function loadTravelAtlas(): Promise<TravelAtlas | undefined> {
  const file = process.env.MUSCLESCOUT_TRAVEL_FILE || "public/data/travel.json";
  try {
    const s = await stat(file);
    if (
      cached?.file === file &&
      cached.mtime === s.mtimeMs &&
      cached.size === s.size
    )
      return cached.atlas;
    const atlas = travelAtlasSchema.parse(
      JSON.parse(await readFile(file, "utf8")),
    );
    cached = { file, mtime: s.mtimeMs, size: s.size, atlas };
    return atlas;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw e;
  }
}
export async function enrichTravel(listings: Listing[]) {
  return projectTravel(listings, await loadTravelAtlas());
}
