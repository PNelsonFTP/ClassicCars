import { listingSchema, type Listing } from "../../shared/schema";
import { identify, generation } from "../../shared/search";
import { parseLocation } from "./adapters";
// Research/manual inputs are converted at the boundary; all application code uses Listing v1.
export function normalizeObserved(
  raw: Record<string, any>,
  sourceName: string,
): Listing {
  const title = raw.title || "",
    identity = identify(title),
    observed = raw.lastObservedAt || raw.observedAt,
    price = raw.price || {},
    detailed = raw.detailEnriched || raw.enrichment === "detail_observed";
  const convertLocation = (l: Record<string, any> | null) => {
    if (!l) return null;
    if (l.label) return parseLocation(l.label);
    if (l.city && l.state)
      return {
        ...parseLocation(`${l.city}, ${l.state}`),
        ...(l.postalCode ? { postalCode: l.postalCode } : {}),
      };
    return null;
  };
  const sellerLocation = convertLocation(
      raw.sellerLocation || raw.seller?.location || raw.vehicleLocation,
    ),
    offsite =
      /off.?site|unknown|unresolved/.test(raw.vehicleLocation?.status || "") ||
      raw.vehicleLocation?.precision === "unknown";
  const vehicleLocation = offsite
    ? null
    : detailed && raw.vehicleLocation?.precision !== "dealer-city"
      ? convertLocation(raw.vehicleLocation)
      : null;
  const specs: Listing["specs"] = {};
  const fields: Record<string, string> = {
    installedEngine: "engineInstalled",
    transmission: "transmission",
    odometerAdvertised: "odometer",
    mileageStatus: "mileageStatus",
    exteriorColor: "exteriorColor",
    interiorColor: "interiorColor",
    bodyStyle: "bodyStyle",
  };
  for (const [k, v] of Object.entries(raw.specifications || {}))
    if (v != null)
      specs[fields[k] || k] = {
        value: v as string,
        basis: "seller-claimed",
        sourceUrl: raw.sourceUrl,
        observedAt: observed,
      };
  for (const field of ["transmission", "exteriorColor", "interiorColor"])
    if (raw[field])
      specs[field] = {
        value: raw[field],
        basis: "seller-claimed",
        sourceUrl: raw.sourceUrl,
        observedAt: observed,
      };
  if (raw.mileage) {
    if (raw.mileage.reading != null)
      specs.odometer = { value: raw.mileage.reading, basis: "seller-claimed" };
    specs.odometerUnits = {
      value: raw.mileage.units || "mi",
      basis: "seller-claimed",
    };
    specs.mileageStatus = {
      value: raw.mileage.status || "unknown",
      basis: "unknown",
      note: "Advertised odometer, not established total mileage",
    };
  }
  let specialty: Listing["specialty"] = null;
  if (identity.model === "Mustang") {
    if (
      /SVT|Cobra/i.test(title) &&
      identity.year &&
      identity.year >= 1993 &&
      identity.year <= 2004
    )
      specialty = "SVT/Cobra";
    else if (/Shelby|GT[ -]?(350|500)/i.test(title))
      specialty = "Shelby GT350/GT500";
    else if (/Boss/i.test(title)) specialty = "Boss";
    else if (/Mach\s*1/i.test(title)) specialty = "Mach 1";
    else if (/\bGTD\b/i.test(title)) specialty = "GTD";
  }
  const saleType =
    raw.saleType === "fixed-price" ? "fixed" : raw.saleType || "unknown";
  const availability =
    raw.availability === "sale-pending"
      ? "pending"
      : saleType === "auction" && !raw.auctionEnd
        ? "unknown"
        : raw.availability || "unknown";
  const url = raw.sourceUrl || raw.url;
  return listingSchema.parse({
    schemaVersion: 1,
    id: raw.id || `${raw.sourceId}:${raw.sourceListingId}`,
    sourceId: raw.sourceId,
    sourceListingId: raw.sourceListingId,
    sourceName,
    url,
    title,
    ...identity,
    advertisedYear:
      raw.advertisedYear || raw.advertisedModelYear || identity.advertisedYear,
    generation: generation(identity),
    make:
      identity.model === "Mustang"
        ? "Ford"
        : identity.model
          ? "Chevrolet"
          : null,
    specialty,
    specialtyEvidence: specialty ? "seller-claimed" : "unknown",
    authenticity:
      raw.authenticity?.type === "tribute_or_replica"
        ? "tribute"
        : /tribute/i.test(title)
          ? "tribute"
          : /clone/i.test(title)
            ? "clone"
            : /replica/i.test(title)
              ? "replica"
              : "unknown",
    identifier: raw.identifier || raw.sellerIdentifier || null,
    stockNumber: raw.stockNumber || null,
    saleType,
    availability,
    askingPrice: raw.askingPrice ?? price.askingPrice ?? null,
    currentBid: price.currentBid ?? null,
    priceOnRequest: raw.priceOnRequest || price.priceOnRequest || false,
    seller: {
      name: raw.seller?.name || sourceName,
      type: raw.seller?.type || raw.sellerType || "unknown",
      location: sellerLocation,
    },
    vehicleLocation,
    specs,
    photos: (raw.photos || [])
      .filter(
        (p: unknown) =>
          typeof p === "string" && p.startsWith("https://") && !p.includes("{"),
      )
      .slice(0, 100),
    flags: [
      ...(raw.flags || raw.dataFlags || []),
      ...(!detailed ? ["Detail enrichment pending"] : []),
    ],
    description:
      raw.description ||
      `Seller advertises ${title}. ${Object.entries(specs)
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${v.value}`)
        .join(
          "; ",
        )}. Confirm condition, price and actual stock location with the source.`,
    originalSellerText:
      raw.originalSellerTitle || raw.originalSellerExcerpt || title,
    firstSeenAt: raw.firstSeenAt || raw.firstObservedAt || observed,
    lastObservedAt: observed,
    lastNetworkCheckedAt: raw.lastNetworkCheckedAt || observed,
    route: null,
    routeUnknownReason: offsite
      ? "Seller identifies off-site or unresolved stock; actual vehicle location must be confirmed."
      : vehicleLocation
        ? "Driving route has not been calculated."
        : "Seller location is recorded separately; actual stock location needs detail review.",
    parserVersion: `${raw.sourceId}-${detailed ? "detail" : "catalog"}-research-v1`,
    scope: "regional",
    evidenceRef: raw.evidenceRef,
  });
}
