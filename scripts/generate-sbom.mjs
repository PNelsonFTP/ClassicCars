import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";

// Documentation only: reads npm metadata; never installs, updates or executes packages.
const root = path.resolve(import.meta.dirname, "..");
const folder = path.join(root, "docs/sbom");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const pkgBytes = await readFile(path.join(root, "package.json"));
const lockBytes = await readFile(path.join(root, "package-lock.json"));
const pkg = JSON.parse(pkgBytes);
const lock = JSON.parse(lockBytes);
const timestamp = new Date().toISOString();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
await mkdir(folder, { recursive: true });

function runNpm(args) {
  const result = spawnSync(npm, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 30e6,
    env: { ...process.env, npm_config_update_notifier: "false" },
  });
  if (result.status !== 0)
    throw new Error(
      `npm ${args.join(" ")} failed. No package changes were attempted.\n${result.stderr || result.error}`,
    );
  return result.stdout;
}
const npmVersion = runNpm(["--version"]).trim();
const generated = [];
async function save(name, content) {
  const text =
    typeof content === "string"
      ? content
      : JSON.stringify(content, null, 2) + "\n";
  const target = path.join(folder, name);
  await writeFile(target + ".tmp", text);
  await rename(target + ".tmp", target);
  generated.push({
    file: name,
    bytes: Buffer.byteLength(text),
    sha256: sha256(text),
  });
}
const counts = {};
for (const [filename, format, omitDev] of [
  ["musclescout.cdx.json", "cyclonedx", false],
  ["musclescout-runtime.cdx.json", "cyclonedx", true],
  ["musclescout.spdx.json", "spdx", false],
]) {
  const args = [
    "sbom",
    "--offline",
    `--sbom-format=${format}`,
    "--sbom-type=application",
    ...(omitDev ? ["--omit=dev"] : []),
  ];
  const bom = JSON.parse(runNpm(args));
  if (format === "cyclonedx") {
    // npm uses the checkout directory name here; use the actual package name.
    bom.metadata.component.name = pkg.name;
    bom.metadata.component.properties.push(
      {
        name: "musclescout:inventory-basis",
        value: "installed npm dependency graph on the recorded platform",
      },
      { name: "musclescout:package-lock:sha256", value: sha256(lockBytes) },
    );
    const refs = new Set([
      bom.metadata.component["bom-ref"],
      ...bom.components.map((c) => c["bom-ref"]),
    ]);
    if (refs.size !== bom.components.length + 1)
      throw new Error("Duplicate CycloneDX references");
    for (const edge of bom.dependencies) {
      if (!refs.has(edge.ref) || edge.dependsOn.some((ref) => !refs.has(ref)))
        throw new Error("Unresolved CycloneDX dependency reference");
    }
    counts[filename] = {
      dependencies: bom.components.length,
      rootComponents: 1,
      graphEntries: bom.dependencies.length,
    };
  } else {
    const ids = new Set([bom.SPDXID, ...bom.packages.map((p) => p.SPDXID)]);
    for (const r of bom.relationships)
      if (!ids.has(r.spdxElementId) || !ids.has(r.relatedSpdxElement))
        throw new Error("Unresolved SPDX relationship");
    counts[filename] = {
      packagesIncludingRoot: bom.packages.length,
      relationships: bom.relationships.length,
    };
  }
  await save(filename, bom);
}

const entries = Object.entries(lock.packages)
  .filter(([location]) => location)
  .map(([location, p]) => ({
    location,
    name: p.name || location.split("node_modules/").at(-1),
    version: p.version,
    resolved: p.resolved || null,
    integrity: p.integrity || null,
    license: p.license || "NOASSERTION",
    dev: !!p.dev,
    optional: !!p.optional,
    devOptional: !!p.devOptional,
    installedOnThisHost: existsSync(path.join(root, location, "package.json")),
    os: p.os || null,
    cpu: p.cpu || null,
    libc: p.libc || null,
    dependencies: p.dependencies || {},
    optionalDependencies: p.optionalDependencies || {},
    peerDependencies: p.peerDependencies || {},
    bundledDependencies: p.bundleDependencies || p.bundledDependencies || [],
  }))
  .sort((a, b) => a.location.localeCompare(b.location));
const gaps = [
  {
    component: "@tailwindcss/oxide-wasm32-wasi@4.3.3",
    status:
      "npm 11.19.0 lock-only SBOM export returned ESBOMPROBLEMS during the documentation audit",
    detail:
      "Optional WASM package is not installed on this macOS host. Its metadata declares bundled dependencies; four dependency edges have no separately resolved lockfile entry. Their exact bundled versions are not inferred.",
    unresolvedBundledRanges: {
      "@emnapi/core": "^1.11.1",
      "@emnapi/wasi-threads": "^1.2.2",
      "@napi-rs/wasm-runtime": "^1.1.4",
      "@tybys/wasm-util": "^0.10.2",
    },
    observedAgainstLockSha256:
      "e8e19800d9cbdfb26b673831fc73ce96641c01ec7b577836db5a424f6f4c3092",
  },
];
await save("lockfile-inventory.json", {
  format: "musclescout-lockfile-inventory",
  version: 1,
  generatedAt: timestamp,
  lockfileVersion: lock.lockfileVersion,
  lockfileSha256: sha256(lockBytes),
  entryCount: entries.length,
  installedEntryCount: entries.filter((e) => e.installedOnThisHost).length,
  knownHistoricalExportGaps: gaps,
  packages: entries,
});
const direct = Object.entries({
  ...pkg.dependencies,
  ...pkg.devDependencies,
}).map(([name, requested]) => {
  const e = entries.find((e) => e.location === `node_modules/${name}`);
  if (!e)
    throw new Error(`Missing direct dependency in lock inventory: ${name}`);
  return {
    name,
    requested,
    version: e.version,
    license: e.license,
    usage: pkg.devDependencies?.[name]
      ? "development/build/test"
      : "application/build dependency",
  };
});
const licenses = Object.entries(
  entries.reduce((counts, p) => {
    counts[p.license] = (counts[p.license] || 0) + 1;
    return counts;
  }, {}),
).sort((a, b) => a[0].localeCompare(b[0]));
const cell = (value) =>
  String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
await save(
  "LICENSE_INVENTORY.md",
  `# Dependency license inventory\n\nGenerated ${timestamp} from package-lock.json, SHA-256 \`${sha256(lockBytes)}\`. Counts are lockfile installation locations, including optional platform packages and repeated versions. These are package-declared license expressions, not a verification of every shipped file. MuscleScout itself has no declared distribution license. Listing content, images, map data and external services are outside these npm license grants.\n\n## Declared license totals\n\n| License expression | Lock entries |\n|---|---:|\n${licenses.map(([license, n]) => `| ${cell(license)} | ${n} |`).join("\n")}\n\n## Direct dependencies\n\n| Package | Requested | Locked version | License | Package role |\n|---|---|---|---|---|\n${direct.map((p) => `| ${p.name} | ${p.requested} | ${p.version} | ${cell(p.license)} | ${p.usage} |`).join("\n")}\n\n## All lockfile entries\n\n| Package | Version | License | Location | Installed on generation host |\n|---|---|---|---|---|\n${entries.map((p) => `| ${p.name} | ${p.version} | ${cell(p.license)} | ${p.location} | ${p.installedOnThisHost ? "Yes" : "No"} |`).join("\n")}\n`,
);
const auditPath = path.join(folder, "npm-audit.json");
const audit = existsSync(auditPath) ? await readFile(auditPath) : null;
await save("manifest.json", {
  generatedAt: timestamp,
  application: {
    name: pkg.name,
    version: pkg.version,
    declaredLicense: pkg.license || "NOASSERTION",
  },
  platform: process.platform,
  architecture: process.arch,
  node: process.version,
  npm: npmVersion,
  inputs: {
    packageJsonSha256: sha256(pkgBytes),
    packageLockSha256: sha256(lockBytes),
  },
  counts,
  lockEntries: entries.length,
  installedLockEntries: entries.filter((e) => e.installedOnThisHost).length,
  files: generated,
  audit: audit
    ? {
        file: "npm-audit.json",
        sha256: sha256(audit),
        note: "Separate advisory query; generation does not refresh it. See SBOM.md for its observation date.",
      }
    : null,
  limitations: [
    "Installed graph SBOMs are platform-specific and not a browser-bundle or container OS SBOM.",
    "Lockfile inventory includes optional platform packages; bundled files without separate resolved versions remain an explicit gap.",
    "npm licenses/advisories do not grant rights to third-party vehicle photos or listing data.",
  ],
});
console.log(
  JSON.stringify(
    {
      folder: "docs/sbom",
      counts,
      lockEntries: entries.length,
      installedLockEntries: entries.filter((e) => e.installedOnThisHost).length,
      files: generated.map((f) => f.file),
    },
    null,
    2,
  ),
);
