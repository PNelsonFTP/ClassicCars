import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
const entries = [];
async function walk(folder, parentPackage = null) {
  let owner = parentPackage;
  try {
    const pkg = JSON.parse(
      await readFile(path.join(folder, "package.json"), "utf8"),
    );
    if (pkg.name && pkg.version)
      owner = { name: pkg.name, version: pkg.version };
  } catch {}
  for (const item of await readdir(folder, { withFileTypes: true })) {
    if (item.isSymbolicLink()) continue;
    const file = path.join(folder, item.name);
    if (item.isDirectory()) await walk(file, owner);
    else if (/\.(node|wasm)$/.test(item.name)) {
      const bytes = await readFile(file);
      entries.push({
        path: path.relative(root, file).split(path.sep).join("/"),
        kind: item.name.endsWith(".node") ? "native-node-addon" : "webassembly",
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        owningPackage: owner,
        embeddedComponentVersions:
          "not inferred from owning package or filename",
      });
    }
  }
}
await walk(path.join(root, "node_modules"));
entries.sort((a, b) => a.path.localeCompare(b.path));
const osPackages =
  process.platform === "linux"
    ? spawnSync(
        "dpkg-query",
        ["-W", "-f=${Package}\t${Version}\t${Architecture}\n"],
        { encoding: "utf8" },
      )
    : null;
const report = {
  generatedAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
  lockfileSha256: createHash("sha256")
    .update(await readFile(path.join(root, "package-lock.json")))
    .digest("hex"),
  nativeAndWasmArtifacts: entries,
  osPackageInventory:
    osPackages?.status === 0
      ? osPackages.stdout
          .trim()
          .split("\n")
          .map((line) => {
            const [name, version, architecture] = line.split("\t");
            return { name, version, architecture };
          })
      : null,
  limitations: [
    "File hashes and owning package versions are observed; embedded component versions require their own evidence.",
    "OS package inventory covers dpkg only when available on the target; other package managers and manually installed OS files remain outside this report.",
  ],
};
await mkdir(path.join(root, "docs/sbom"), { recursive: true });
await writeFile(
  path.join(root, "docs/sbom/target-artifacts.json"),
  JSON.stringify(report, null, 2) + "\n",
);
const manifestFile = path.join(root, "docs/sbom/manifest.json");
const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
if (
  manifest.inputs.packageLockSha256 !== report.lockfileSha256 ||
  manifest.inputs.packageJsonSha256 !==
    hash(await readFile(path.join(root, "package.json")))
)
  throw new Error(
    "Regenerate the main SBOM before its target artifact manifest.",
  );
for (const name of ["target-artifacts.json", "bundled-artifacts.json"]) {
  let bytes;
  try {
    bytes = await readFile(path.join(root, "docs/sbom", name));
  } catch {
    continue;
  }
  manifest.files = manifest.files.filter((entry) => entry.file !== name);
  manifest.files.push({ file: name, bytes: bytes.length, sha256: hash(bytes) });
}
await writeFile(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  JSON.stringify({
    platform: report.platform,
    architecture: report.architecture,
    artifacts: entries.length,
    osPackages: report.osPackageInventory?.length ?? null,
  }),
);
