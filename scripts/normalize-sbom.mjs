import { isDeepStrictEqual } from "node:util";

const installPath = "cdx:npm:package:path";
const unique = (values) => [
  ...new Map(values.map((value) => [JSON.stringify(value), value])).values(),
];

// npm 10 emits one component per install location with a name@version ID.
// Coalesce only identical package metadata: keep every installation path and
// every outgoing edge. Conflicting identities must fail instead of being hidden.
export function normalizeCycloneDx(bom) {
  const rootRef = bom.metadata.component["bom-ref"];
  const components = new Map();
  for (const component of bom.components) {
    const ref = component["bom-ref"];
    if (ref === rootRef)
      throw new Error("CycloneDX component conflicts with root reference");
    const previous = components.get(ref);
    if (!previous) {
      components.set(ref, component);
      continue;
    }
    const identity = (value) => ({
      ...value,
      properties: (value.properties || []).filter(
        (p) => p.name !== installPath,
      ),
    });
    if (!isDeepStrictEqual(identity(previous), identity(component)))
      throw new Error(`Conflicting CycloneDX components: ${ref}`);
    previous.properties = unique([
      ...(previous.properties || []),
      ...(component.properties || []),
    ]);
  }
  const dependencies = new Map();
  for (const edge of bom.dependencies) {
    const previous = dependencies.get(edge.ref);
    if (!previous) {
      dependencies.set(edge.ref, {
        ...edge,
        dependsOn: [...new Set(edge.dependsOn)],
      });
      continue;
    }
    const identity = ({ dependsOn, ...rest }) => rest;
    if (!isDeepStrictEqual(identity(previous), identity(edge)))
      throw new Error(`Conflicting CycloneDX dependency metadata: ${edge.ref}`);
    previous.dependsOn = [
      ...new Set([...previous.dependsOn, ...edge.dependsOn]),
    ];
  }
  bom.components = [...components.values()];
  bom.dependencies = [...dependencies.values()];
  assertCycloneDxReferences(bom);
  return bom;
}

export function assertCycloneDxReferences(bom) {
  const refs = new Set([
    bom.metadata.component["bom-ref"],
    ...bom.components.map((c) => c["bom-ref"]),
  ]);
  if (refs.size !== bom.components.length + 1 || [...refs].some((ref) => !ref))
    throw new Error("Duplicate or missing CycloneDX references");
  const graphRefs = new Set();
  for (const edge of bom.dependencies) {
    if (graphRefs.has(edge.ref))
      throw new Error("Duplicate CycloneDX dependency entry");
    graphRefs.add(edge.ref);
    if (!refs.has(edge.ref) || edge.dependsOn.some((ref) => !refs.has(ref)))
      throw new Error("Unresolved CycloneDX dependency reference");
    if (new Set(edge.dependsOn).size !== edge.dependsOn.length)
      throw new Error("Duplicate CycloneDX dependency target");
  }
}

export function normalizeSpdx(bom) {
  const groups = new Map();
  for (const item of bom.packages) {
    if (item.SPDXID === bom.SPDXID)
      throw new Error("SPDX package conflicts with document ID");
    const group = groups.get(item.SPDXID) || [];
    group.push(item);
    groups.set(item.SPDXID, group);
  }
  bom.packages = [...groups].map(([ref, group]) => {
    const first = group[0];
    if (group.length === 1) return first;
    const identity = ({ packageFileName, ...rest }) => rest;
    if (
      group.some((item) => !isDeepStrictEqual(identity(first), identity(item)))
    )
      throw new Error(`Conflicting SPDX packages: ${ref}`);
    const locations = [
      ...new Set(group.map((item) => item.packageFileName).filter(Boolean)),
    ];
    if (!locations.length) return first;
    const item = identity(first);
    // SPDX has a single packageFileName. Preserve all paths in an annotation
    // rather than misrepresenting one location as the only installed copy.
    item.annotations = [
      ...(item.annotations || []),
      {
        annotationDate: bom.creationInfo.created,
        annotationType: "OTHER",
        annotator: "Tool: MuscleScout SBOM normalization",
        comment: `npm install locations for this package identity: ${JSON.stringify(locations)}. Relationships retain the union of all installed copies.`,
      },
    ];
    return item;
  });
  bom.relationships = unique(bom.relationships);
  assertSpdxReferences(bom);
  return bom;
}

export function assertSpdxReferences(bom) {
  const ids = new Set([bom.SPDXID, ...bom.packages.map((p) => p.SPDXID)]);
  if (ids.size !== bom.packages.length + 1 || [...ids].some((id) => !id))
    throw new Error("Duplicate or missing SPDX identifiers");
  for (const ref of bom.documentDescribes || [])
    if (!ids.has(ref)) throw new Error("Unresolved SPDX document description");
  for (const relation of bom.relationships)
    if (
      !ids.has(relation.spdxElementId) ||
      !ids.has(relation.relatedSpdxElement)
    )
      throw new Error("Unresolved SPDX relationship");
}
