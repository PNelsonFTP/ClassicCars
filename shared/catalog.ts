import type { Listing, Snapshot } from "./schema";
/** fieldValue permits arbitrary Listing paths; retain them. Only spec values are predicate-visible. */
export function catalogListing(listing: Listing): Listing {
  return {
    ...listing,
    specs: Object.fromEntries(
      Object.entries(listing.specs).map(([key, evidence]) => [
        key,
        { value: evidence.value, basis: evidence.basis },
      ]),
    ),
  };
}
export function catalogSnapshot(
  snapshot: Snapshot,
  detailFiles: Record<string, string>,
): Snapshot {
  return {
    ...snapshot,
    listings: snapshot.listings.map(catalogListing),
    detailFiles,
  };
}
type PackedKey = string | number;
export type PackedValue =
  | null
  | boolean
  | number
  | string
  | ["r", number]
  | ["a", PackedValue[]]
  | ["o", [PackedKey, PackedValue][]];
export type PackedCatalog = {
  encoding: "musclescout-dictionary-v1";
  strings: string[];
  value: PackedValue;
};
/** Lossless JSON transport: container tags prevent user arrays/objects resembling references from colliding. */
export function packCatalog(value: unknown): PackedCatalog {
  const counts = new Map<string, number>(),
    keys = new Set<string>();
  function count(input: unknown, depth = 0) {
    if (depth > 80) throw new Error("Catalog nesting exceeds supported depth.");
    if (
      input &&
      typeof input === "object" &&
      !Array.isArray(input) &&
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))
    )
      throw new Error("Catalog transport requires plain JSON objects.");
    if (typeof input === "string")
      counts.set(input, (counts.get(input) || 0) + 1);
    else if (Array.isArray(input))
      for (const child of input) count(child, depth + 1);
    else if (input && typeof input === "object")
      for (const [key, child] of Object.entries(input)) {
        if (
          child === undefined ||
          typeof child === "function" ||
          typeof child === "symbol"
        )
          continue;
        counts.set(key, (counts.get(key) || 0) + 1);
        keys.add(key);
        count(child, depth + 1);
      }
  }
  count(value);
  const strings = [...counts]
    .filter(([text, n]) => n > 1 && (keys.has(text) || text.length >= 16))
    .map(([text]) => text);
  const indexes = new Map(strings.map((text, index) => [text, index]));
  function encode(input: unknown, depth = 0): PackedValue {
    if (depth > 80) throw new Error("Catalog nesting exceeds supported depth.");
    if (input == null || (typeof input === "number" && !Number.isFinite(input)))
      return null;
    if (typeof input === "string") {
      const index = indexes.get(input);
      return index == null ? input : ["r", index];
    }
    if (typeof input === "number" || typeof input === "boolean") return input;
    if (Array.isArray(input))
      return ["a", input.map((child) => encode(child, depth + 1))];
    if (typeof input === "object")
      return [
        "o",
        Object.entries(input)
          .filter(
            ([, child]) =>
              child !== undefined &&
              typeof child !== "function" &&
              typeof child !== "symbol",
          )
          .map(([key, child]) => [
            indexes.get(key) ?? key,
            encode(child, depth + 1),
          ]),
      ];
    if (["undefined", "function", "symbol"].includes(typeof input)) return null;
    throw new Error("Catalog transport supports JSON values only.");
  }
  return {
    encoding: "musclescout-dictionary-v1",
    strings,
    value: encode(value),
  };
}
/** Accept older plain snapshots during migration; validate tagged envelopes before returning data. */
export function unpackCatalog<T = Snapshot>(payload: unknown): T {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("encoding" in payload) ||
    payload.encoding !== "musclescout-dictionary-v1"
  )
    return payload as T;
  const encoded = payload as Partial<PackedCatalog>;
  if (
    !Array.isArray(encoded.strings) ||
    encoded.strings.some((value) => typeof value !== "string")
  )
    throw new Error("Invalid catalog string dictionary.");
  const strings = encoded.strings;
  let nodes = 0;
  function reference(index: unknown) {
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= strings.length
    )
      throw new Error("Invalid catalog dictionary reference.");
    return strings[index];
  }
  function decode(input: unknown, depth = 0): unknown {
    if (++nodes > 20000000 || depth > 80)
      throw new Error("Catalog transport exceeds supported size or depth.");
    if (
      input === null ||
      typeof input === "boolean" ||
      typeof input === "string"
    )
      return input;
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if (!Array.isArray(input) || input.length !== 2)
      throw new Error("Invalid tagged catalog value.");
    if (input[0] === "r") return reference(input[1]);
    if (input[0] === "a" && Array.isArray(input[1]))
      return input[1].map((child) => decode(child, depth + 1));
    if (input[0] === "o" && Array.isArray(input[1])) {
      const result: Record<string, unknown> = {};
      for (const pair of input[1]) {
        if (!Array.isArray(pair) || pair.length !== 2)
          throw new Error("Invalid catalog object entry.");
        const key = typeof pair[0] === "string" ? pair[0] : reference(pair[0]);
        if (Object.hasOwn(result, key))
          throw new Error("Duplicate catalog object key.");
        Object.defineProperty(result, key, {
          value: decode(pair[1], depth + 1),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      return result;
    }
    throw new Error("Unrecognized catalog transport tag.");
  }
  return decode(encoded.value) as T;
}
