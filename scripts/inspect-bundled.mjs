import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import path from "node:path";
const argument = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const root = path.resolve(
  argument("root") || path.join(import.meta.dirname, ".."),
);
const key = "node_modules/@tailwindcss/oxide-wasm32-wasi";
const lock = JSON.parse(
  await readFile(path.join(root, "package-lock.json"), "utf8"),
);
const pkg = lock.packages[key];
if (
  !pkg?.resolved?.startsWith(
    "https://registry.npmjs.org/@tailwindcss/oxide-wasm32-wasi/-/",
  ) ||
  !pkg.integrity?.startsWith("sha512-")
)
  throw new Error(
    "Expected a registry-pinned WASM optional package with SHA-512 integrity",
  );
let bytes;
if (argument("archive"))
  bytes = await readFile(path.resolve(argument("archive")));
else if (process.argv.includes("--fetch")) {
  const response = await fetch(pkg.resolved, {
    signal: AbortSignal.timeout(25000),
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(`Artifact request failed HTTP ${response.status}`);
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    if (length > 30e6) throw new Error("Archive exceeds 30 MB limit");
    chunks.push(chunk);
  }
  bytes = Buffer.concat(chunks);
} else
  throw new Error(
    "Usage: node scripts/inspect-bundled.mjs --archive=/path/to/locked-package.tgz (offline), or --fetch for the exact locked registry artifact",
  );
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
if (
  bytes.length > 30e6 ||
  "sha512-" + createHash("sha512").update(bytes).digest("base64") !==
    pkg.integrity
)
  throw new Error("Archive size or lockfile integrity check failed");
const tar = gunzipSync(bytes, { maxOutputLength: 64e6 });
const readText = (buffer) => buffer.toString("utf8").replace(/\0.*$/s, "");
const packages = [];
for (let offset = 0; offset + 512 <= tar.length;) {
  const header = tar.subarray(offset, offset + 512);
  if (header.every((value) => value === 0)) break;
  const name = [
    readText(header.subarray(345, 500)),
    readText(header.subarray(0, 100)),
  ]
    .filter(Boolean)
    .join("/");
  const sizeText = readText(header.subarray(124, 136)).trim();
  if (!/^[0-7]+$/.test(sizeText))
    throw new Error("Unsupported tar size encoding");
  const size = Number.parseInt(sizeText, 8),
    type = readText(header.subarray(156, 157));
  if (offset + 512 + size > tar.length)
    throw new Error("Truncated archive member");
  if (
    (type === "0" || type === "") &&
    name.endsWith("/package.json") &&
    name.startsWith("package/") &&
    !name.split("/").includes("..") &&
    size < 1e6
  ) {
    const content = tar.subarray(offset + 512, offset + 512 + size),
      metadata = JSON.parse(content.toString("utf8"));
    if (metadata.name && metadata.version)
      packages.push({
        path: name,
        name: metadata.name,
        version: metadata.version,
        license: metadata.license || "NOASSERTION",
        packageJsonSha256: sha256(content),
        dependencies: metadata.dependencies || {},
      });
  }
  offset += 512 + Math.ceil(size / 512) * 512;
}
const requested = [
  "@emnapi/core",
  "@emnapi/wasi-threads",
  "@napi-rs/wasm-runtime",
  "@tybys/wasm-util",
];
const report = {
  schemaVersion: 1,
  observedAt: new Date().toISOString(),
  package: "@tailwindcss/oxide-wasm32-wasi",
  version: pkg.version,
  artifactUrl: pkg.resolved,
  lockfileIntegrity: pkg.integrity,
  integrityVerified: true,
  artifactSha256: sha256(bytes),
  bytes: bytes.length,
  installed: false,
  codeExecuted: false,
  observedPackages: packages,
  unresolvedRequestedPackages: requested.filter(
    (name) => !packages.some((entry) => entry.name === name),
  ),
  limits: [
    "Package manifest versions are observed from this exact archive; embedded native/WASM component versions are not inferred.",
    "This optional platform archive was inspected, not installed or executed. It is not part of the installed host graph solely because it was inspected.",
  ],
};
const output = path.resolve(
  argument("output") || path.join(root, "docs/sbom/bundled-artifacts.json"),
);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify({
    output,
    packagesObserved: packages.length,
    unresolvedRequestedPackages: report.unresolvedRequestedPackages,
    integrityVerified: true,
    codeExecuted: false,
  }),
);
