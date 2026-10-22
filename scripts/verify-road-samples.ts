import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import type { Place } from "../shared/travel-contract";
const places: Place[] = [];
for (const state of ["IL", "WI", "MI", "IN", "MO"])
  places.push(
    ...JSON.parse(await readFile(`public/places/${state}.json`, "utf8")).places,
  );
const city = (name: string, state: string) => {
  const p = places.find(
    (p) => p.kind === "place" && p.city === name && p.state === state,
  );
  assert(p, `Missing ${name}, ${state}`);
  return p;
};
const pairs = [
    ["Wheaton", "IL", "Volo", "IL"],
    ["Wheaton", "IL", "Milwaukee", "WI"],
    ["Wheaton", "IL", "Indianapolis", "IN"],
    ["Wheaton", "IL", "Grand Rapids", "MI"],
    ["Wheaton", "IL", "St. Louis", "MO"],
    ["Milwaukee", "WI", "Muskegon", "MI"],
  ],
  results = [];
for (const [a, as, b, bs] of pairs) {
  const from = city(a, as),
    to = city(b, bs);
  const url = `http://127.0.0.1:5015/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?exclude=ferry&radiuses=2500;2500&overview=full&geometries=geojson&steps=true`;
  const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    }),
    body = await response.json();
  assert.equal(body.code, "Ok");
  const route = body.routes[0],
    minLatitude = Math.min(
      ...route.geometry.coordinates.map((p: number[]) => p[1]),
    );
  assert(
    !route.legs
      .flatMap((l: { steps: { mode: string }[] }) => l.steps)
      .some((s: { mode: string }) => s.mode === "ferry"),
  );
  if (a === "Milwaukee") {
    assert(route.distance / 1609.344 > 250);
    assert(route.duration / 60 > 180);
    assert(
      minLatitude < 42.1,
      "A Lake Michigan land route must detour around the southern shore",
    );
  }
  results.push({
    origin: `${a}, ${as}`,
    destination: `${b}, ${bs}`,
    minutes: route.duration / 60,
    miles: route.distance / 1609.344,
    exclude: "ferry",
    minLatitude,
    noFerrySteps: true,
  });
}
const atlas = JSON.parse(await readFile("public/data/travel.json", "utf8"));
const report = {
  verifiedAt: new Date().toISOString(),
  provider: "Local OSRM 26.10.0 / OpenStreetMap",
  graphVersion: atlas.graph.version,
  roadTimestamp: atlas.graph.observedAt,
  lakeMichiganLandDetourVerified: true,
  claims:
    "Traffic-free city baselines; not independent real-traffic calibration",
  results,
};
await mkdir("data/reports/travel", { recursive: true, mode: 0o700 });
await writeFile(
  "data/reports/travel/road-samples.json",
  JSON.stringify(report, null, 2) + "\n",
  { mode: 0o600 },
);
console.log(JSON.stringify(report, null, 2));
