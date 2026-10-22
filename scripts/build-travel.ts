import { readFile, writeFile, rename, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { listingSchema } from "../shared/schema";
import {
  placeSchema,
  travelAtlasSchema,
  ROAD_PROFILE,
  placeKey,
  type RoadEstimate,
  type TravelAtlas,
} from "../shared/travel-contract";
import { createPlaceIndex, resolvePlace, isOffsite } from "../shared/travel";
const arg = (key: string) =>
  process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const places = [];
for (const name of await readdir("public/places"))
  if (/^[A-Z]{2}\.json$/.test(name))
    places.push(
      ...(
        JSON.parse(await readFile(`public/places/${name}`, "utf8"))
          .places as unknown[]
      ).map((p) => placeSchema.parse(p)),
    );
const index = createPlaceIndex(places),
  listings = (
    JSON.parse(await readFile("public/data/snapshot.json", "utf8"))
      .listings as unknown[]
  ).map((l) => listingSchema.parse(l));
const originText = arg("origin") || "Wheaton,IL";
const originParts = originText.match(/^(.+),\s*([A-Za-z]{2})$/);
if (!originParts)
  throw Error("Use --origin=City,ST with a two-letter US state.");
const [, city, state] = originParts;
const origin = resolvePlace({ city, state, country: "US" }, index);
if (!origin)
  throw Error("Origin must match a unique city,state in the local catalog.");
const destinations = new Map<string, typeof origin>();
for (const l of listings) {
  if (isOffsite(l)) continue;
  const p = resolvePlace(l.vehicleLocation || l.seller.location, index);
  if (p) destinations.set(p.id, p);
}
let old: TravelAtlas | undefined;
try {
  old = travelAtlasSchema.parse(
    JSON.parse(await readFile("public/data/travel.json", "utf8")),
  );
} catch {}
const offline = process.argv.includes("--offline");
let graph: TravelAtlas["graph"];
if (offline) {
  if (!old)
    throw Error(
      "No previously generated road atlas; run local routing generation first.",
    );
  graph = old.graph;
} else
  graph = travelAtlasSchema.shape.graph.parse(
    JSON.parse(
      await readFile(arg("manifest") || "data/routing/manifest.json", "utf8"),
    ),
  );
const matchesDestination = (e: RoadEstimate) => {
  const p = destinations.get(e.destinationId);
  return (
    !!p && p.lon === e.destinationPoint[0] && p.lat === e.destinationPoint[1]
  );
};
const originKey = placeKey(origin),
  estimates: RoadEstimate[] = (old?.estimates || []).filter(
    (e) =>
      e.graphVersion === graph.version &&
      matchesDestination(e) &&
      e.originKey !== originKey,
  );
const unresolved: Record<string, string> = {};
if (offline) {
  estimates.push(
    ...old!.estimates.filter(
      (e) =>
        e.originKey === originKey &&
        matchesDestination(e) &&
        e.originPoint[0] === origin.lon &&
        e.originPoint[1] === origin.lat,
    ),
  );
  for (const [id, reason] of Object.entries(old!.unresolved))
    if (destinations.has(id)) unresolved[id] = reason;
} else {
  const base = new URL(arg("endpoint") || "http://127.0.0.1:5015");
  if (
    base.protocol !== "http:" ||
    base.hostname !== "127.0.0.1" ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw Error(
      "Local OSRM must use an explicitly configured loopback HTTP origin.",
    );
  for (const destination of destinations.values()) {
    const coords = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
    const url = new URL(`/route/v1/driving/${coords}`, base);
    url.searchParams.set("exclude", "ferry");
    url.searchParams.set("overview", "false");
    url.searchParams.set("radiuses", "2500;2500");
    url.searchParams.set("steps", "false");
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
    const result = await response.json();
    if (!response.ok || result.code !== "Ok" || !result.routes?.[0]) {
      unresolved[destination.id] =
        `No road route in ${graph.region}; ${result.code || response.status}`;
      continue;
    }
    const route = result.routes[0],
      snaps = result.waypoints;
    const e: RoadEstimate = {
      originKey,
      destinationId: destination.id,
      originPoint: [origin.lon, origin.lat],
      destinationPoint: [destination.lon, destination.lat],
      graphObservedAt: graph.observedAt,
      minutes: route.duration / 60,
      miles: route.distance / 1609.344,
      computedAt: new Date().toISOString(),
      provider: "OSRM / OpenStreetMap",
      graphVersion: graph.version,
      profile: ROAD_PROFILE,
      originSnapMeters: snaps[0].distance,
      destinationSnapMeters: snaps[1].distance,
    };
    if (
      !Number.isFinite(e.minutes) ||
      Math.max(e.originSnapMeters, e.destinationSnapMeters) > 2500
    )
      unresolved[destination.id] = "City point too far from an accessible road";
    else estimates.push(e);
  }
}
if (!estimates.some((e) => e.originKey === originKey))
  throw Error(
    "No usable road table for this origin. Generate routes online with a supported regional city; offline reuse cannot invent a new origin.",
  );
const atlas = travelAtlasSchema.parse({
  version: 1,
  generatedAt: new Date().toISOString(),
  origins: [
    ...(old?.origins || []).filter(
      (p) =>
        placeKey(p) !== originKey &&
        estimates.some((e) => e.originKey === placeKey(p)),
    ),
    origin,
  ],
  places: [...destinations.values()],
  estimates,
  graph,
  unresolved,
});
await writeFile("public/data/travel.json.tmp", JSON.stringify(atlas) + "\n");
await rename("public/data/travel.json.tmp", "public/data/travel.json");
console.log(
  JSON.stringify({
    origin: originText,
    destinations: destinations.size,
    routes: estimates.filter((e) => e.originKey === originKey).length,
    unresolved: Object.keys(unresolved).length,
    artifactSha256: createHash("sha256")
      .update(JSON.stringify(atlas))
      .digest("hex"),
  }),
);
