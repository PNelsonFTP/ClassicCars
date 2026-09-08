import type { Listing } from "./schema";

/** Aliases are reviewed input, never an inferred identity or authenticity claim. */
export type SellerAlias = {
  alias: string;
  canonical: string;
  reason: string;
  reviewedAt: string;
  evidenceUrl?: string;
};
export type DuplicateDecision = {
  pairId: string;
  ids: [string, string];
  action: "dismissed" | "restored";
  reason: string;
  reviewedAt: string;
};
export type DuplicateCandidate = {
  id: string;
  ids: [string, string];
  score: number;
  confidence:
    "strong-evidence" | "corroborated" | "review-only" | "conflicting";
  evidence: { field: string; explanation: string; weight: number }[];
  conflicts: {
    field: string;
    left: string;
    right: string;
    explanation: string;
  }[];
  dismissed: boolean;
  /** These are source-ad summaries. No source ask is collapsed into a vehicle ask. */
  ads: {
    id: string;
    url: string;
    source: string;
    title: string;
    ask: number | null;
    seller: string;
    identifier: string | null;
    stock: string | null;
    observedAt: string;
  }[];
};
export type DuplicatePage = {
  rows: DuplicateCandidate[];
  total: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  diagnostics: {
    listings: number;
    indexKeys: number;
    comparedPairs: number;
    titleOnlyExcluded: true;
    groupsAreVerifiedUniqueCars: false;
  };
};

const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const unknown =
  /^(?:unknown|n a|none|private seller|seller detail pending|call|pending)$/;
const usable = (value: string | null | undefined) =>
  !!value && !unknown.test(normalize(value));
export function normalizeStock(
  value: string | null | undefined,
): string | null {
  if (!usable(value)) return null;
  // Keep leading zeroes and slash/dot suffixes: these can be dealer-significant.
  const stock = value!
    .normalize("NFKC")
    .toUpperCase()
    .replace(/^\s*(?:STOCK(?:\s*(?:NO\.?|NUMBER))?\s*[:#-]?|#)\s*/i, "")
    .replace(/[\s-]+/g, "");
  return stock && !/^0+$/.test(stock) ? stock : null;
}
export function canonicalSeller(
  value: string,
  aliases: SellerAlias[] = [],
): string | null {
  if (!usable(value)) return null;
  const normalized = normalize(value);
  // Only direct, auditable aliases are followed. Reject chains/cycles when saved.
  return normalize(
    aliases.find((a) => normalize(a.alias) === normalized)?.canonical ?? value,
  );
}
export function validateSellerAliases(aliases: SellerAlias[]): string | null {
  const keys = aliases.map((a) => canonicalSeller(a.alias));
  if (
    keys.some((key) => !key) ||
    aliases.some((a) => !canonicalSeller(a.canonical))
  )
    return "Use established dealer names; unknown seller placeholders are not aliases.";
  if (new Set(keys).size !== keys.length)
    return "Each dealer alias may have only one canonical target.";
  if (aliases.some((a) => keys.includes(canonicalSeller(a.canonical))))
    return "Alias chains or cycles are not allowed. Point every alias directly to the final canonical dealer name.";
  return null;
}
export function normalizedIdentifier(
  value: string | null | undefined,
): string | null {
  if (!usable(value)) return null;
  const id = value!.toUpperCase().replace(/[\s-]/g, "");
  return /^[A-Z0-9]{6,17}$/.test(id) && !/^(?:0+|X+)$/.test(id) ? id : null;
}
export function completeIdentifier(l: Listing): string | null {
  const id = normalizedIdentifier(l.identifier);
  if (!id || !l.year || !l.model) return null;
  if (
    l.year >= 1981 &&
    /^[A-HJ-NPR-Z0-9]{17}$/.test(id) &&
    !/^0{3}|X{2}|0{6}/.test(id)
  )
    return id;
  if (
    l.model === "Mustang" &&
    l.year >= 1965 &&
    l.year <= 1969 &&
    /^[5-9][FRT][0-9]{2}[A-Z][0-9]{6}$/.test(id) &&
    Number(id[0]) === l.year % 10
  )
    return id;
  return null;
}
export function pairId(a: string, b: string) {
  return JSON.stringify([a, b].sort());
}
function spec(l: Listing, keys: string[]) {
  for (const key of keys) {
    const value = l.specs[key]?.value;
    if (value != null && usable(String(value))) return normalize(String(value));
  }
  return null;
}
function mileage(l: Listing) {
  const value = l.specs.mileage?.value ?? l.specs.odometer?.value;
  const n =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/,/g, ""));
  // Zero and round marketing placeholders are not matching evidence.
  return Number.isFinite(n) && n > 0 && n % 1000 !== 0 ? n : null;
}
function distinctiveTitle(l: Listing) {
  const words = normalize(l.title)
    .split(" ")
    .filter(
      (w) =>
        !/^(?:19\d\d|20\d\d|ford|chevrolet|chevy|mustang|camaro|camero|corvette|for|sale|used|classic|car|beautiful|nice|great|new|price|reduced|coupe|convertible|cabriolet|fastback|hardtop)$/.test(
          w,
        ),
    );
  return words.length >= 2 ? words.join(" ") : null;
}
export function identifierConflicts(
  a: Listing,
  b: Listing,
): DuplicateCandidate["conflicts"] {
  const left = normalizedIdentifier(a.identifier),
    right = normalizedIdentifier(b.identifier);
  if (!left || !right || left === right) return [];
  // An apparent partial suffix of the complete ID remains uncertain, not a proven contradiction.
  if (
    (left.length < right.length && right.endsWith(left)) ||
    (right.length < left.length && left.endsWith(right))
  )
    return [];
  return [
    {
      field: "identifier",
      left,
      right,
      explanation:
        "The source identifiers disagree. Resolve the documents before grouping; automatic grouping is forbidden.",
    },
  ];
}
/** The existing strong-key matcher must also pass this gate before auto-grouping. */
export function mayAutoGroup(a: Listing, b: Listing): boolean {
  return (
    a.id !== b.id &&
    a.model === b.model &&
    a.year === b.year &&
    a.identityStatus !== "review" &&
    b.identityStatus !== "review" &&
    identifierConflicts(a, b).length === 0 &&
    !a.groupId?.startsWith("reviewed:") &&
    !b.groupId?.startsWith("reviewed:")
  );
}
export function explainDuplicate(
  a: Listing,
  b: Listing,
  aliases: SellerAlias[] = [],
): DuplicateCandidate {
  const ids = [a.id, b.id].sort() as [string, string];
  if (ids[0] !== a.id) [a, b] = [b, a];
  const evidence: DuplicateCandidate["evidence"] = [],
    conflicts = identifierConflicts(a, b);
  const add = (field: string, explanation: string, weight: number) =>
    evidence.push({ field, explanation, weight });
  const vinA = completeIdentifier(a),
    vinB = completeIdentifier(b),
    rawA = normalizedIdentifier(a.identifier),
    rawB = normalizedIdentifier(b.identifier);
  if (vinA && vinA === vinB)
    add(
      "identifier",
      "Same eligible complete identifier reported by both ads; this is matching evidence, not authenticated paperwork.",
      80,
    );
  else if (rawA && rawA === rawB)
    add(
      "identifier",
      "Same partial or unsupported historical identifier; manual documentation review is required.",
      16,
    );
  const sellerA = canonicalSeller(a.seller.name, aliases),
    sellerB = canonicalSeller(b.seller.name, aliases);
  const sameSeller =
    sellerA &&
    sellerA === sellerB &&
    ["dealer", "consignment"].includes(a.seller.type) &&
    ["dealer", "consignment"].includes(b.seller.type);
  if (sameSeller)
    add("seller", "Dealer names agree after the reviewed alias registry.", 12);
  const stockA = normalizeStock(a.stockNumber),
    stockB = normalizeStock(b.stockNumber);
  if (sameSeller && stockA && stockA === stockB)
    add(
      "stockNumber",
      "Same dealer and conservatively normalized stock number; raw values remain visible.",
      42,
    );
  else if (sameSeller && stockA && stockB && stockA !== stockB)
    conflicts.push({
      field: "stockNumber",
      left: a.stockNumber!,
      right: b.stockNumber!,
      explanation:
        "The same dealer reports different stock numbers. They may identify different vehicles.",
    });
  for (const [field, keys, weight] of [
    ["exteriorColor", ["exteriorColor", "color"], 5],
    ["interiorColor", ["interiorColor"], 4],
    ["transmission", ["transmission", "transmissionType"], 4],
  ] as const) {
    const left = spec(a, [...keys]),
      right = spec(b, [...keys]);
    if (left && left === right)
      add(
        field,
        `Matching reported ${field.replace(/([A-Z])/g, " $1").toLowerCase()}.`,
        weight,
      );
    else if (left && right)
      conflicts.push({
        field,
        left,
        right,
        explanation:
          "Reported specifications differ; source wording or a real change may explain this.",
      });
  }
  const milesA = mileage(a),
    milesB = mileage(b);
  if (milesA != null && milesB != null && Math.abs(milesA - milesB) <= 25)
    add(
      "mileage",
      "Reported non-placeholder odometer readings are within 25 miles; displayed miles may not be actual mileage.",
      12,
    );
  const titleA = distinctiveTitle(a),
    titleB = distinctiveTitle(b);
  if (titleA && titleA === titleB)
    add(
      "title",
      "Matching distinctive title terms. Generic year/make/model titles are excluded from matching indexes.",
      6,
    );
  const locationA = a.vehicleLocation,
    locationB = b.vehicleLocation;
  if (
    locationA &&
    locationB &&
    !locationA.offsite &&
    !locationB.offsite &&
    normalize(locationA.city) === normalize(locationB.city) &&
    normalize(locationA.state) === normalize(locationB.state)
  )
    add(
      "vehicleLocation",
      "Same reported vehicle city/state; it may be a dealer lot with many similar cars.",
      4,
    );
  if (a.model !== b.model || a.year !== b.year)
    conflicts.push({
      field: "identity",
      left: `${a.year} ${a.model}`,
      right: `${b.year} ${b.model}`,
      explanation:
        "Model or normalized year disagrees despite shared identifier evidence.",
    });
  const hardConflict = conflicts.some((c) =>
    ["identifier", "identity"].includes(c.field),
  );
  const score = Math.min(
    100,
    evidence.reduce((sum, e) => sum + e.weight, 0),
  );
  return {
    id: pairId(...ids),
    ids,
    score,
    confidence: hardConflict
      ? "conflicting"
      : score >= 54
        ? "strong-evidence"
        : score >= 22
          ? "corroborated"
          : "review-only",
    evidence,
    conflicts,
    dismissed: false,
    ads: [a, b].map((l) => ({
      id: l.id,
      url: l.url,
      source: l.sourceName,
      title: l.title,
      ask: l.askingPrice,
      seller: l.seller.name,
      identifier: l.identifier,
      stock: l.stockNumber,
      observedAt: l.lastObservedAt,
    })),
  };
}

/** Indexed candidate generation. Generic title-only pairs are deliberately not candidates. */
export function rankDuplicateCandidates(
  listings: Listing[],
  options: {
    aliases?: SellerAlias[];
    decisions?: DuplicateDecision[];
    offset?: number;
    limit?: number;
    includeDismissed?: boolean;
  } = {},
): DuplicatePage {
  const aliases = options.aliases ?? [],
    decisions = new Map((options.decisions ?? []).map((d) => [d.pairId, d]));
  const index = new Map<string, Listing[]>();
  const add = (key: string, l: Listing) => {
    const bucket = index.get(key);
    if (bucket) bucket.push(l);
    else index.set(key, [l]);
  };
  for (const l of listings) {
    if (l.isSample || !l.model || !l.year) continue;
    const block = `${l.model}:${l.year}`,
      identifier = normalizedIdentifier(l.identifier),
      seller = canonicalSeller(l.seller.name, aliases),
      stock = normalizeStock(l.stockNumber),
      title = distinctiveTitle(l),
      miles = mileage(l);
    if (identifier) add(`identifier:${identifier}`, l);
    if (seller && stock && ["dealer", "consignment"].includes(l.seller.type))
      add(`${block}:stock:${seller}:${stock}`, l);
    // Distinctive title + one corroborating attribute stops generic-title explosions.
    const color = spec(l, ["exteriorColor", "color"]);
    if (title && color) add(`${block}:title-color:${title}:${color}`, l);
    if (title && seller && ["dealer", "consignment"].includes(l.seller.type))
      add(`${block}:title-seller:${title}:${seller}`, l);
    if (miles != null && color)
      add(`${block}:miles-color:${Math.round(miles / 25)}:${color}`, l);
  }
  const seen = new Set<string>(),
    rows: DuplicateCandidate[] = [];
  for (const bucket of index.values())
    for (let i = 0; i < bucket.length; i++)
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i],
          b = bucket[j],
          id = pairId(a.id, b.id);
        if (
          a.id === b.id ||
          (a.groupId && a.groupId === b.groupId) ||
          seen.has(id)
        )
          continue;
        seen.add(id);
        const dismissed = decisions.get(id)?.action === "dismissed";
        if (dismissed && !options.includeDismissed) continue;
        const candidate = explainDuplicate(a, b, aliases);
        rows.push({ ...candidate, dismissed });
      }
  rows.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const offset = Math.max(0, Math.floor(options.offset ?? 0)),
    limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 20)));
  return {
    rows: rows.slice(offset, offset + limit),
    total: rows.length,
    offset,
    limit,
    nextOffset: offset + limit < rows.length ? offset + limit : null,
    diagnostics: {
      listings: listings.length,
      indexKeys: index.size,
      comparedPairs: seen.size,
      titleOnlyExcluded: true,
      groupsAreVerifiedUniqueCars: false,
    },
  };
}
