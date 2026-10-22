import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { listingSchema, defaultSearch, type Snapshot } from "../shared/schema";
import {
  travelAtlasSchema,
  placeSchema,
  DEFAULT_ORIGIN,
  placeKey,
} from "../shared/travel-contract";
import { projectSnapshot } from "../shared/freshness";
import { travelQuality, travelResult } from "../shared/travel";
import { searchListings } from "../shared/search";
import { unpackCatalog } from "../shared/catalog";
const root = path.resolve(
  process.argv.find((a) => a.startsWith("--public="))?.slice(9) || "public",
);
const readJSON = async (file: string) =>
  JSON.parse(await readFile(path.join(root, file), "utf8"));
function checkPrivate(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert(
      child == null ||
        !/^(?:workspace|userOverrides|sourceRecord|evidenceRef|password|token|apiKey|smtpPass|orsKey|localGraph)$/i.test(
          key,
        ),
      `Unexpected private field in public data: ${key}`,
    );
    checkPrivate(child);
  }
}
const atlas = travelAtlasSchema.parse(await readJSON("data/travel.json"));
const snapshot = (await readJSON("data/snapshot.json")) as Snapshot;
const catalog = unpackCatalog<Snapshot>(await readJSON("data/catalog.json"));
checkPrivate(snapshot);
checkPrivate(catalog);
assert(
  atlas.origins.some((p) => placeKey(p) === DEFAULT_ORIGIN),
  "Published Wheaton origin is missing",
);
assert.deepEqual(
  snapshot.travelAtlas,
  atlas,
  "Snapshot and travel artifact disagree",
);
assert.deepEqual(
  catalog.travelAtlas,
  atlas,
  "Catalog and travel artifact disagree",
);
assert(atlas.estimates.length > 0, "No real road estimates were published");
const sha = (s: string | Buffer) =>
  createHash("sha256").update(s).digest("hex");
function safeListing(row: unknown) {
  checkPrivate(row);
  const l = listingSchema.parse(row);
  assert(!l.isSample, `Fictional ad in public inventory: ${l.id}`);
  assert.equal(l.identifier, null, `Private identifier: ${l.id}`);
  assert.equal(l.originalSellerText, "", `Unredacted seller excerpt: ${l.id}`);
  assert(
    !l.userOverrides && !l.sourceRecord && !l.evidenceRef,
    `Private evidence: ${l.id}`,
  );
  return l;
}
snapshot.listings = snapshot.listings.map(safeListing);
catalog.listings = catalog.listings.map(safeListing);
assert.deepEqual(
  snapshot.listings.map((l) => l.id),
  catalog.listings.map((l) => l.id),
);
let chunks = 0;
for (const file of new Set(Object.values(catalog.detailFiles || {}))) {
  assert(/^details\/[a-f0-9]{24}\.json$/.test(file), "Unexpected detail path");
  const bytes = await readFile(path.join(root, "data", file));
  assert.equal(sha(bytes).slice(0, 24), path.basename(file, ".json"));
  for (const row of JSON.parse(bytes.toString())) safeListing(row);
  chunks++;
}
const manifest = await readJSON("places/manifest.json");
let places = 0;
for (const state of manifest.states) {
  assert(/^[A-Z]{2}$/.test(state));
  const rows = (await readJSON(`places/${state}.json`)).places.map(
    (p: unknown) => placeSchema.parse(p),
  );
  assert(rows.every((p: { state: string }) => p.state === state));
  places += rows.length;
  const expected: Record<string, string[]> = {
    IN: ["Indianapolis"],
    MI: ["Traverse City"],
    KS: ["Dodge City"],
  };
  for (const city of expected[state] || [])
    assert(
      rows.some(
        (p: { city: string; kind: string }) =>
          p.kind === "place" && p.city === city,
      ),
      `Canonical Census name lost: ${city}, ${state}`,
    );
}
const now = Date.now(),
  full = projectSnapshot(snapshot, now),
  compact = projectSnapshot(catalog, now),
  filters = defaultSearch();
assert.deepEqual(
  searchListings(full.listings, filters, undefined, now).rows.map((l) => l.id),
  searchListings(compact.listings, filters, undefined, now).rows.map(
    (l) => l.id,
  ),
);
assert(
  full.listings.filter((l) => travelResult(l, filters, now).minutes != null)
    .length > 0,
  "All road evidence is expired or unusable",
);
// Scan all published text for credential-shaped values and unexpected secret files.
let publicBytes = 0,
  files = 0;
async function scan(folder: string) {
  for (const d of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, d.name);
    assert(!d.isSymbolicLink(), "Public symlinks are not allowed");
    assert(
      !/^\.env(?:\.|$)|\.(?:db|sqlite|pem|key)$/i.test(d.name),
      `Private file under public: ${d.name}`,
    );
    if (d.isDirectory()) await scan(file);
    else {
      publicBytes += (await stat(file)).size;
      files++;
      if (/\.(?:json|js|txt|html|md)$/i.test(file)) {
        const text = await readFile(file, "utf8");
        if (file.endsWith(".json")) checkPrivate(JSON.parse(text));
        assert(
          !/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:MUSCLESCOUT_(?:ORS_KEY|PASSWORD)|SMTP_PASS|API_TOKEN)\s*[=:]\s*["']?[A-Za-z0-9_-]{12,})/.test(
            text,
          ),
          `Credential-shaped data: ${path.relative(root, file)}`,
        );
      }
    }
  }
}
await scan(root);
console.log(
  JSON.stringify(
    {
      verifiedAt: new Date(now).toISOString(),
      exportGeneratedAt: snapshot.generatedAt,
      latestInventoryObservation: new Date(
        Math.max(...snapshot.listings.map((l) => Date.parse(l.lastObservedAt))),
      ).toISOString(),
      publicAds: snapshot.listings.length,
      origins: atlas.origins.map((p) => `${p.city}, ${p.state}`),
      roadGraph: atlas.graph,
      places,
      routedPlaces: atlas.estimates.length,
      unresolvedPlaces: Object.keys(atlas.unresolved).length,
      quality: travelQuality(full.listings, filters, now),
      defaultResults: searchListings(full.listings, filters, undefined, now)
        .rawCount,
      detailChunks: chunks,
      publicFiles: files,
      publicBytes,
      travelSha256: sha(JSON.stringify(atlas)),
      privacyScan: true,
      catalogParity: true,
    },
    null,
    2,
  ),
);
