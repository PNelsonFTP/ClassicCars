import { rankDuplicateCandidates } from "./duplicates";
import {
  defaultSearch,
  type Listing,
  type Search,
  type Workspace,
} from "./schema";
export const normalizeText = (s: string) =>
  s
    .toLowerCase()
    .replace(/camero/g, "camaro")
    .replace(/\s+/g, " ")
    .trim();
export function identify(title: string) {
  const text = normalizeText(title);
  const model = /\bmustang\b/.test(text)
    ? "Mustang"
    : /\bcamaro\b/.test(text)
      ? "Camaro"
      : /\bcorvette\b/.test(text)
        ? "Corvette"
        : null;
  const years = [
    ...text.matchAll(/\b(19\d{2}|20\d{2})(?:[½]|[ -]?1\/2|\.5)?/g),
  ];
  const advertisedYear = years[0]?.[0] ?? null;
  let year = years[0] ? Number(years[0][1]) : null;
  const halfYear =
    model === "Mustang" &&
    year === 1964 &&
    !!advertisedYear &&
    /½|1\/2|\.5/.test(advertisedYear);
  if (halfYear) year = 1965;
  const notes: string[] = [];
  if (!model || !year) notes.push("Model or model year is missing.");
  if (new Set(years.map((y) => y[1])).size > 1)
    notes.push("Conflicting advertised years; review the source.");
  if (
    (model === "Mustang" && year && year < 1965) ||
    (model === "Camaro" && year && year < 1967) ||
    (model === "Corvette" && year === 1983)
  )
    notes.push(
      "Advertised year requires identity review against manufacturer history.",
    );
  return {
    model: model as Listing["model"],
    year,
    advertisedYear,
    identityStatus: notes.length
      ? ("review" as const)
      : ("consistent" as const),
    identityNotes: notes,
  };
}
export function generation(l: Pick<Listing, "model" | "year">) {
  const y = l.year;
  if (
    !y ||
    (l.model === "Mustang" && y < 1965) ||
    (l.model === "Corvette" && y < 1953)
  )
    return null;
  if (l.model === "Mustang")
    return y <= 1973
      ? "First generation"
      : y <= 1978
        ? "Mustang II"
        : y <= 1993
          ? "Fox body"
          : null;
  if (l.model === "Camaro")
    return y < 1967
      ? null
      : y <= 1969
        ? "First generation"
        : y <= 1981
          ? "Second generation"
          : y <= 1992
            ? "Third generation"
            : null;
  if (l.model === "Corvette")
    return y <= 1962
      ? "C1"
      : y <= 1967
        ? "C2"
        : y <= 1982
          ? "C3"
          : y >= 1984 && y <= 1996
            ? "C4"
            : null;
  return null;
}
export function targetMatch(l: Listing, s: Search) {
  if (
    l.identityStatus === "review" ||
    !l.year ||
    !l.model ||
    (l.model === "Mustang" && l.year < 1965) ||
    (l.model === "Camaro" && l.year < 1967) ||
    (l.model === "Corvette" && (l.year < 1953 || l.year === 1983))
  )
    return false;
  const classic =
    s.models.includes(l.model) && l.year >= s.minYear && l.year <= s.maxYear;
  const special =
    s.specialty &&
    l.model === "Mustang" &&
    l.year >= 1960 &&
    l.year <= s.specialtyMaxYear &&
    !!l.specialty &&
    s.variants.includes(l.specialty) &&
    ["document-supported", "user-reviewed"].includes(l.specialtyEvidence) &&
    !["tribute", "clone", "replica"].includes(l.authenticity);
  return classic || special;
}
export function routeKnown(l: Listing, now = Date.now(), maxAgeDays = 30) {
  return (
    !!l.route &&
    !!l.vehicleLocation &&
    !l.vehicleLocation.offsite &&
    !["unknown", "ambiguous"].includes(l.vehicleLocation.precision) &&
    Date.parse(l.route.observedAt) <= now &&
    now - Date.parse(l.route.observedAt) <= maxAgeDays * 864e5
  );
}
export function fieldValue(l: Listing, field: string): unknown {
  return field.startsWith("specs.")
    ? l.specs[field.slice(6)]?.value
    : field
        .split(".")
        .reduce<unknown>(
          (v, k) =>
            v && typeof v === "object"
              ? (v as Record<string, unknown>)[k]
              : undefined,
          l,
        );
}
export function matches(
  l: Listing,
  s: Search,
  w?: Workspace,
  now = Date.now(),
) {
  if (s.mode === "identity-review") {
    if (l.identityStatus !== "review") return false;
  } else if (s.mode === "specialty-review") {
    if (
      l.model !== "Mustang" ||
      !l.specialty ||
      !["seller-claimed", "unknown"].includes(l.specialtyEvidence) ||
      !l.year ||
      l.year < 1960 ||
      l.year > s.specialtyMaxYear
    )
      return false;
  } else if (!targetMatch(l, s)) return false;
  if (
    s.mode === "everyday" &&
    (l.vehicleLocation?.country !== "US" ||
      !routeKnown(l, now, s.routeMaxAgeDays) ||
      l.route!.minutes > s.maxMinutes)
  )
    return false;
  if (s.mode === "unknown-route" && routeKnown(l, now, s.routeMaxAgeDays))
    return false;
  if (s.mode === "regional" && l.scope !== "regional") return false;
  if (s.mode === "nationwide" && l.vehicleLocation?.country !== "US")
    return false;
  if (s.mode === "auctions" && l.saleType !== "auction") return false;
  if (
    s.mode !== "auctions" &&
    s.saleTypes.length &&
    !s.saleTypes.includes(l.saleType)
  )
    return false;
  if (s.availability.length && !s.availability.includes(l.availability))
    return false;
  if (s.states.length && !s.states.includes(l.vehicleLocation?.state ?? ""))
    return false;
  if (s.sources.length && !s.sources.includes(l.sourceId)) return false;
  if (l.askingPrice == null) {
    if (!s.unknownPrice) return false;
  } else if (
    (s.minPrice != null && l.askingPrice < s.minPrice) ||
    (s.maxPrice != null && l.askingPrice > s.maxPrice)
  )
    return false;
  const text = normalizeText(
    [l.title, l.description, l.model, l.year, l.trim].join(" "),
  );
  if (
    s.query &&
    !normalizeText(s.query)
      .split(" ")
      .every((q) => text.includes(q))
  )
    return false;
  if (
    s.excludeText &&
    normalizeText(s.excludeText)
      .split(",")
      .some((q) => q.trim() && text.includes(q.trim()))
  )
    return false;
  if (
    s.maxAgeDays != null &&
    now - Date.parse(l.lastObservedAt) > s.maxAgeDays * 864e5
  )
    return false;
  if (s.favoritesOnly && !w?.favorites.includes(l.id)) return false;
  return s.rules.every((r) => {
    const v = fieldValue(l, r.field),
      unknown =
        v === undefined ||
        v === null ||
        (typeof v === "string" &&
          /^(unknown|unspecified|n\/a|not stated)(\b|$)/i.test(v));
    if (r.operator === "known") return !unknown;
    if (r.operator === "unknown") return unknown;
    if (unknown) return false;
    if (r.operator === "min")
      return typeof v === "number" && v >= Number(r.value);
    if (r.operator === "max")
      return typeof v === "number" && v <= Number(r.value);
    const equal = String(v)
      .toLowerCase()
      .includes(String(r.value).toLowerCase());
    return r.operator === "include" ? equal : !equal;
  });
}
export function searchListings(
  listings: Listing[],
  s: Search,
  w?: Workspace,
  now = Date.now(),
) {
  let rows = listings.filter((l) => matches(l, s, w, now));
  const value = (l: Listing) =>
    s.sort === "nearest"
      ? routeKnown(l, now, s.routeMaxAgeDays)
        ? l.route!.minutes
        : 1e6 + (l.straightLineMiles ?? 1e6)
      : s.sort === "price-asc"
        ? (l.askingPrice ?? Infinity)
        : s.sort === "price-desc"
          ? -(l.askingPrice ?? -Infinity)
          : s.sort === "year"
            ? -(l.year ?? 0)
            : s.sort === "deadline"
              ? l.auctionEnd
                ? Date.parse(l.auctionEnd)
                : Infinity
              : -Date.parse(l.firstSeenAt);
  rows = rows.sort((a, b) => value(a) - value(b) || a.id.localeCompare(b.id));
  const rawCount = rows.length;
  const groupCount = new Set(rows.map((l) => l.groupId || l.id)).size;
  if (s.grouped) {
    const seen = new Set<string>();
    rows = rows.filter((l) => {
      const key = l.groupId || l.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  return {
    rows,
    rawCount,
    groupCount,
  };
}
export function quickSearch(mode: Search["mode"], previous?: Search): Search {
  const s = defaultSearch();
  s.mode = mode;
  if (previous) {
    s.specialty = previous.specialty;
    s.variants = previous.variants;
    s.specialtyMaxYear = previous.specialtyMaxYear;
  }
  if (["regional", "identity-review", "specialty-review"].includes(mode)) {
    s.availability = [];
    s.saleTypes = [];
  }
  if (mode === "unknown-route") {
    s.availability = ["active", "unknown", "pending"];
    s.saleTypes = ["fixed", "negotiable", "unknown"];
  }
  if (mode === "auctions") {
    s.availability = ["upcoming-auction", "live-auction"];
    s.saleTypes = ["auction"];
    s.sort = "deadline";
  }
  return s;
}
export function strongGroupKey(l: Listing) {
  const vin = l.identifier?.toUpperCase();
  const modern =
    !!vin &&
    !!l.year &&
    l.year >= 1981 &&
    /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) &&
    !/^0{3}|X{2}|0{6}/.test(vin);
  const historic =
    !!vin &&
    !!l.year &&
    l.model === "Mustang" &&
    l.year >= 1965 &&
    l.year <= 1969 &&
    /^[5-9][FRT][0-9]{2}[A-Z][0-9]{6}$/.test(vin) &&
    Number(vin[0]) === l.year % 10;
  if (vin && (modern || historic)) return `${l.model}:${l.year}:${vin}`;
  if (
    l.stockNumber &&
    l.seller.name &&
    ["dealer", "consignment"].includes(l.seller.type) &&
    !["unknown", "private seller", "seller detail pending"].includes(
      normalizeText(l.seller.name),
    ) &&
    l.year &&
    l.model
  )
    return `${normalizeText(l.seller.name)}:${l.stockNumber}:${l.year}:${l.model}`;
  return null;
}
/** Compatibility helper; paginated review consumers should call rankDuplicateCandidates directly. */
export function potentialDuplicates(listings: Listing[]) {
  const page = rankDuplicateCandidates(listings, { limit: 100 });
  const pairs = page.rows.map((c) => c.ids);
  for (let offset = 100; offset < page.total; offset += 100)
    pairs.push(
      ...rankDuplicateCandidates(listings, { offset, limit: 100 }).rows.map(
        (c) => c.ids,
      ),
    );
  return pairs;
}
export function storageKey(basePath: string, mode: string, backend = "") {
  return `musclescout:v1:${basePath.replace(/\/$/, "") || "/"}:${mode}${mode === "connected" || mode === "session" ? ":" + backend : ""}`;
}
export function money(value: number | null) {
  return value == null
    ? "Price on request"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
}
export const specFields: Record<string, string> = {
  engineInstalled: "Installed engine",
  engineOriginal: "Original engine",
  displacementCI: "Displacement · cu in",
  displacementL: "Displacement · liters",
  cylinders: "Cylinders",
  fuelDelivery: "Fuel delivery",
  fuelType: "Fuel type",
  forcedInduction: "Forced induction",
  engineSwap: "Engine swap disclosed",
  engineRebuild: "Engine rebuild disclosed",
  horsepower: "Reported horsepower",
  horsepowerBasis: "HP measurement basis",
  torque: "Reported torque",
  torqueBasis: "Torque measurement basis",
  transmission: "Transmission",
  gears: "Gears",
  transmissionIdentity: "Transmission identity",
  transmissionOriginal: "Original transmission",
  differential: "Differential",
  axleRatio: "Axle ratio",
  limitedSlip: "Limited slip",
  odometer: "Odometer",
  odometerUnits: "Odometer units",
  mileageStatus: "Mileage status",
  odometerDigits: "Odometer display digits",
  restorationMiles: "Miles since restoration",
  rebuildMiles: "Miles since rebuild",
  running: "Running claim",
  roadworthy: "Roadworthiness claim",
  condition: "Condition claim",
  restoration: "Restoration type",
  paintCondition: "Paint condition",
  bodyCondition: "Body condition",
  interiorCondition: "Interior condition",
  rust: "Rust disclosure",
  structuralRepair: "Structural repairs",
  titleStatus: "Title status claim",
  titleInHand: "Title in hand",
  accident: "Accident disclosure",
  flood: "Flood disclosure",
  fire: "Fire disclosure",
  ownership: "Ownership history",
  documentation: "Documentation",
  restorationDate: "Restoration date",
  restorationScope: "Restoration scope",
  receipts: "Receipts",
  inspection: "Inspection report",
  serviceHistory: "Service history",
  originality: "Originality claim",
  numbersMatching: "Numbers matching claim",
  matchingEngine: "Engine matching evidence",
  matchingTransmission: "Transmission matching evidence",
  cowlTag: "Cowl tag evidence",
  bodyStyle: "Body style",
  exteriorColor: "Exterior color",
  interiorColor: "Interior color",
  factoryColor: "Factory color claim",
  topCondition: "Convertible top",
  tTops: "T-tops",
  ac: "Air conditioning",
  powerSteering: "Power steering",
  powerBrakes: "Power brakes",
  discBrakes: "Disc brakes",
  suspension: "Suspension changes",
  exhaust: "Exhaust",
  wheels: "Wheels",
  seatBelts: "Seat belts",
};
