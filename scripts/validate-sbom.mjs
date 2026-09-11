import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import {
  assertCycloneDxReferences,
  assertSpdxReferences,
} from "./normalize-sbom.mjs";
const arg = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(arg("root") || path.join(import.meta.dirname, ".."));
const folder = path.resolve(arg("folder") || path.join(root, "docs/sbom"));
const schemas = path.resolve(
  arg("schemas") || path.join(root, "docs/sbom/schemas"),
);
const require = createRequire(
  path.join(arg("validator-root") || root, "package.json"),
);
const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const readJSON = async (file) => JSON.parse(await readFile(file, "utf8"));
const schemaManifest = await readJSON(path.join(schemas, "manifest.json"));
const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: true });
addFormats(ajv);
require("ajv-formats-draft2019")(ajv);
// npm emits git+https / git+ssh transport markers in VCS references. The
// supplementary validator limits schemes to its IANA list, so validate their
// underlying URI transport without changing the evidence stored in the SBOM.
const iriReference = require("ajv-formats-draft2019/formats/iri-reference");
ajv.addFormat("iri-reference", (value) =>
  iriReference(value.replace(/^git\+(https?|ssh):\/\//, "$1://")),
);
for (const entry of schemaManifest.files) {
  const bytes = await readFile(path.join(schemas, entry.file));
  if (sha(bytes) !== entry.sha256)
    throw new Error(`Schema hash mismatch: ${entry.file}`);
  ajv.addSchema(JSON.parse(bytes));
}
const manifest = await readJSON(path.join(folder, "manifest.json"));
for (const entry of manifest.files) {
  if (sha(await readFile(path.join(folder, entry.file))) !== entry.sha256)
    throw new Error(`SBOM artifact hash mismatch: ${entry.file}`);
}
if (
  manifest.inputs.packageJsonSha256 !==
    sha(await readFile(path.join(root, "package.json"))) ||
  manifest.inputs.packageLockSha256 !==
    sha(await readFile(path.join(root, "package-lock.json")))
)
  throw new Error("SBOM was not generated from the current package/lock files");
const checked = [];
for (const file of [
  "musclescout.cdx.json",
  "musclescout-runtime.cdx.json",
  "musclescout.spdx.json",
]) {
  const bom = await readJSON(path.join(folder, file));
  const schema = file.endsWith("cdx.json")
    ? "http://cyclonedx.org/schema/bom-1.5.schema.json"
    : "http://spdx.org/rdf/terms/2.3";
  if (!ajv.validate(schema, bom))
    throw new Error(
      `${file} schema validation failed (${ajv.errors.length} errors):\n${ajv.errorsText(ajv.errors.slice(0, 20), { separator: "\n" })}`,
    );
  if (file.endsWith("cdx.json")) assertCycloneDxReferences(bom);
  else assertSpdxReferences(bom);
  checked.push({ file, schema, valid: true });
}
console.log(
  JSON.stringify(
    {
      checked,
      manifestHashesVerified: manifest.files.length,
      inputHashesVerified: true,
      networkRequests: 0,
    },
    null,
    2,
  ),
);
