import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const checkOnly = process.argv.includes("--check-only");
const run = (args) => {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0)
    throw Error(`Publication check failed: ${args.join(" ")}`);
};
run(["--import", "tsx", "scripts/verify-travel.ts"]);
run(["scripts/validate-sbom.mjs"]);
if (!checkOnly) {
  run(["node_modules/typescript/bin/tsc", "--noEmit"]);
  run(["node_modules/vitest/vitest.mjs", "run"]);
  run(["scripts/release-smoke.mjs"]);
  run(["node_modules/@playwright/test/cli.js", "test"]);
  run(["scripts/build-exports.mjs"]);
  run(["--import", "tsx", "scripts/verify-travel.ts", "--public=out"]);
  run(["--import", "tsx", "scripts/verify-travel.ts", "--public=out-subpath"]);
  run(["--import", "tsx", "scripts/verify-exports.ts"]);
  run(["scripts/validate-release-config.mjs"]);
}
const digest = async (file) =>
  createHash("sha256")
    .update(await readFile(path.join(root, file)))
    .digest("hex");
const receipt = {
  verifiedAt: new Date().toISOString(),
  scope: checkOnly
    ? "public data and travel contract"
    : "types, units, isolated release, desktop/mobile E2E, root and project Pages builds, browser export checks, public data and travel contract",
  published: false,
  inputs: Object.fromEntries(
    await Promise.all(
      [
        "package.json",
        "package-lock.json",
        "public/data/snapshot.json",
        "public/data/catalog.json",
        "public/data/travel.json",
      ].map(async (file) => [file, await digest(file)]),
    ),
  ),
};
await mkdir(path.join(root, "data/reports/publication"), {
  recursive: true,
  mode: 0o700,
});
await writeFile(
  path.join(root, "data/reports/publication/latest.json"),
  JSON.stringify(receipt, null, 2) + "\n",
  { mode: 0o600 },
);
console.log(
  "Publication checks passed. Outputs are ready for review; no Git commit, push or deployment was performed.",
);
