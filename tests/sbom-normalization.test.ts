import { describe, expect, it } from "vitest";
import {
  normalizeCycloneDx,
  normalizeSpdx,
  assertCycloneDxReferences,
  assertSpdxReferences,
} from "../scripts/normalize-sbom.mjs";

const location = (value: string) => ({ name: "cdx:npm:package:path", value });
const component = (path: string) => ({
  "bom-ref": "shared@1.0.0",
  name: "shared",
  version: "1.0.0",
  purl: "pkg:npm/shared@1.0.0",
  hashes: [{ alg: "SHA-256", content: "a".repeat(64) }],
  properties: [location(path)],
});
function cdx() {
  return {
    metadata: { component: { "bom-ref": "root@1.0.0" } },
    components: [
      component("node_modules/shared"),
      component("node_modules/parent/node_modules/shared"),
    ],
    dependencies: [
      { ref: "root@1.0.0", dependsOn: ["shared@1.0.0", "shared@1.0.0"] },
      { ref: "shared@1.0.0", dependsOn: [] },
      { ref: "shared@1.0.0", dependsOn: [] },
    ],
  };
}
function spdx() {
  const item = {
    SPDXID: "SPDXRef-shared",
    name: "shared",
    versionInfo: "1.0.0",
    checksums: [{ algorithm: "SHA256", checksumValue: "a".repeat(64) }],
  };
  const relationship = {
    spdxElementId: "SPDXRef-DOCUMENT",
    relatedSpdxElement: "SPDXRef-shared",
    relationshipType: "DESCRIBES",
  };
  return {
    SPDXID: "SPDXRef-DOCUMENT",
    creationInfo: { created: "2026-09-10T00:00:00Z" },
    documentDescribes: ["SPDXRef-shared"],
    packages: [
      { ...structuredClone(item), packageFileName: "node_modules/shared" },
      {
        ...structuredClone(item),
        packageFileName: "node_modules/parent/node_modules/shared",
      },
    ],
    relationships: [{ ...relationship }, { ...relationship }],
  };
}

describe("npm 10 SBOM identity normalization", () => {
  it("coalesces identical CDX identities, retains both paths and removes duplicate targets", () => {
    const result = normalizeCycloneDx(cdx());
    expect(result.components).toHaveLength(1);
    expect(result.components[0].properties).toEqual([
      location("node_modules/shared"),
      location("node_modules/parent/node_modules/shared"),
    ]);
    expect(result.dependencies).toEqual([
      { ref: "root@1.0.0", dependsOn: ["shared@1.0.0"] },
      { ref: "shared@1.0.0", dependsOn: [] },
    ]);
    expect(normalizeCycloneDx(structuredClone(result))).toEqual(result);
  });
  it("unions all outgoing dependency edges without losing either copy's dependencies", () => {
    const bom = cdx();
    bom.components.push({
      ...component("node_modules/other"),
      "bom-ref": "other@1.0.0",
      name: "other",
      purl: "pkg:npm/other@1.0.0",
    });
    bom.dependencies[2].dependsOn = ["other@1.0.0"];
    expect(
      normalizeCycloneDx(bom).dependencies.find(
        (d: any) => d.ref === "shared@1.0.0",
      )?.dependsOn,
    ).toEqual(["other@1.0.0"]);
  });
  it("rejects conflicting hashes rather than merging different artifacts", () => {
    const bom = cdx();
    bom.components[1].hashes[0].content = "b".repeat(64);
    expect(() => normalizeCycloneDx(bom)).toThrow(
      /Conflicting CycloneDX components/,
    );
  });
  it("rejects a component colliding with the root", () => {
    const bom = cdx();
    bom.components[0]["bom-ref"] = "root@1.0.0";
    expect(() => normalizeCycloneDx(bom)).toThrow(/root reference/);
  });
  it("keeps unresolved CDX edges fatal", () => {
    const bom = cdx();
    bom.dependencies[0].dependsOn.push("absent@1.0.0");
    expect(() => normalizeCycloneDx(bom)).toThrow(/Unresolved/);
  });
  it("leaves an already unique npm 11 graph unchanged", () => {
    const bom = normalizeCycloneDx(cdx());
    expect(normalizeCycloneDx(structuredClone(bom))).toEqual(bom);
  });
  it("coalesces SPDX packages with all install paths recorded and relationships retained", () => {
    const result = normalizeSpdx(spdx());
    expect(result.packages).toHaveLength(1);
    expect(result.packages[0].packageFileName).toBeUndefined();
    expect(result.packages[0].annotations[0].comment).toContain(
      '"node_modules/shared","node_modules/parent/node_modules/shared"',
    );
    expect(result.relationships).toHaveLength(1);
    expect(normalizeSpdx(structuredClone(result))).toEqual(result);
  });
  it("rejects conflicting SPDX checksums", () => {
    const bom = spdx();
    bom.packages[1].checksums[0].checksumValue = "b".repeat(64);
    expect(() => normalizeSpdx(bom)).toThrow(/Conflicting SPDX packages/);
  });
  it("retains distinct SPDX relationship types", () => {
    const bom = spdx();
    bom.relationships[1].relationshipType = "DEPENDENCY_OF";
    expect(normalizeSpdx(bom).relationships).toHaveLength(2);
  });
  it("keeps unresolved SPDX relationships fatal", () => {
    const bom = spdx();
    bom.relationships[0].relatedSpdxElement = "SPDXRef-missing";
    expect(() => normalizeSpdx(bom)).toThrow(/Unresolved/);
  });
  it("independent validation rejects duplicate CDX and SPDX identifiers", () => {
    expect(() => assertCycloneDxReferences(cdx())).toThrow(/Duplicate/);
    expect(() => assertSpdxReferences(spdx())).toThrow(/Duplicate/);
  });
});
