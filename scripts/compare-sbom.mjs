import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const [
  baseline,
  current = "docs/sbom/lockfile-inventory.json",
  output = "test-results/sbom-diff.json",
] = process.argv.slice(2);
if (!baseline)
  throw new Error(
    "Usage: node scripts/compare-sbom.mjs baseline-inventory.json [current-inventory.json] [output.json]",
  );
const read = async (file) =>
  new Map(
    JSON.parse(await readFile(file, "utf8")).packages.map((p) => [
      p.location,
      p,
    ]),
  );
const old = await read(baseline),
  latest = await read(current);
const added = [],
  removed = [],
  changed = [];
for (const [location, item] of latest) {
  const before = old.get(location);
  if (!before) added.push(item);
  else if (
    ["name", "version", "license", "integrity"].some(
      (field) => before[field] !== item[field],
    )
  )
    changed.push({ location, before, after: item });
}
for (const [location, item] of old)
  if (!latest.has(location)) removed.push(item);
const report = { baseline, current, added, removed, changed };
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    added: added.length,
    removed: removed.length,
    changed: changed.length,
    output,
  }),
);
