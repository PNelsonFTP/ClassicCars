// Source-specific parser examples based on public HTTP observations, 2026-09-08.
// Dependency: cheerio. These functions fetch nothing and accept an existing observation timestamp.
import { load } from "cheerio";
const text = ($el) => $el.text().replace(/\s+/g, " ").trim();
const abs = (url, base) => new URL(url, base).href;
const money = (value) => {
  const m = /^\$([\d,]+(?:\.\d+)?)(?:\s*\(OBO\))?$/i.exec(value.trim());
  return m ? Number(m[1].replaceAll(",", "")) : null;
};
const modelFamily = (value) =>
  /\b(camar[oa]|camero)\b/i.test(value)
    ? "Camaro"
    : /\bcorvette\b/i.test(value)
      ? "Corvette"
      : /\bmustang\b/i.test(value)
        ? "Mustang"
        : null;
const price = (raw) => ({
  // A zero catalog offer is a placeholder, not evidence that this car is free.
  askingPrice: money(raw) === 0 ? null : money(raw),
  currency: "USD",
  raw,
  negotiable: /\bOBO\b|best offer/i.test(raw),
  priceOnRequest: /call|request/i.test(raw) || money(raw) === 0,
  currentBid: null,
  buyItNow: null,
});
const excerpt = (s) => s.split(/\s+/).slice(0, 20).join(" ");

export function parseClassicCarsCatalog(
  html,
  { url, observedAt, evidenceRef },
) {
  const $ = load(html);
  const records = new Map();
  const errors = [];
  $(".search-result-item").each((_, element) => {
    const card = $(element);
    const a = card.find('a[href*="/listings/view/"]').first();
    const href = a.attr("href");
    const id = href?.match(/\/listings\/view\/(\d+)(?:\/|$)/)?.[1];
    if (!id || records.has(id)) return;
    const script = card
      .find('script[type="application/ld+json"]')
      .first()
      .text();
    let metadata = {};
    try {
      metadata = JSON.parse(script);
    } catch {
      errors.push(`CC-${id}: invalid card JSON-LD; DOM fallback`);
    }
    if (metadata.sku && metadata.sku !== `CC-${id}`) {
      errors.push(`CC-${id}: SKU/ad URL mismatch`);
      return;
    }
    if (
      metadata.offers?.url &&
      !metadata.offers.url.includes(`/listings/view/${id}/`)
    ) {
      errors.push(`CC-${id}: offer/ad URL mismatch`);
      return;
    }
    const title = text(card.find(".h-sri-car-title")) || metadata.name || "";
    const year = title.match(/^(\d{4})\b/)?.[1];
    const rawPrice = text(card.find(".mrg-b-sri-price"));
    const location = a.attr("aria-label")?.split(" for sale in ")[1] ?? null;
    const img = card.find("img").first();
    const photo = img.attr("data-src") || img.attr("src");
    const model = modelFamily(title);
    const ask = price(rawPrice);
    records.set(id, {
      sourceId: "classiccars",
      sourceListingId: `CC-${id}`,
      sourceUrl: abs(href, url),
      title,
      make: model === "Mustang" ? "Ford" : model ? "Chevrolet" : null,
      model,
      modelYear: year ? Number(year) : null,
      advertisedModelYear: year ?? null,
      originalSellerExcerpt: excerpt(text(card.find(".h-sri-desc-text"))),
      price: ask,
      saleType: /auction/i.test(rawPrice)
        ? "auction"
        : ask.askingPrice !== null || ask.priceOnRequest
          ? "fixed"
          : "unknown",
      availability: "unknown",
      advertisedLocation: location,
      vehicleLocation: {
        label: location,
        precision: "city",
        status: "unverified_catalog_location",
      },
      sellerLocation: null,
      photos: photo ? [abs(photo, url)] : [],
      lastObservedAt: observedAt,
      lastNetworkCheckedAt: observedAt,
      sellerPostedAt: null,
      driveMinutes: null,
      enrichment: "pending",
      dataFlags: ["Detail enrichment pending", "Driving time unavailable"],
      evidence: {
        catalog: evidenceRef,
        selector:
          ".search-result-item; stable ad ID checked against same-card SKU",
      },
    });
  });
  const next = $('link[rel="next"]').attr("href");
  const total = text($("body")).match(/([\d,]+) vehicles matched/);
  return {
    listings: [...records.values()],
    nextUrl: next ? abs(next, url) : null,
    sourceReportedCount: total ? Number(total[1].replaceAll(",", "")) : null,
    errors,
  };
}

export function enrichClassicCarsDetail(
  html,
  existing,
  { url, observedAt, evidenceRef },
) {
  const $ = load(html);
  const specs = {};
  $(".vehicle-details li").each((_, element) => {
    const spans = $(element).children("span");
    if (spans.length >= 2)
      specs[text(spans.eq(0)).replace(/:$/, "")] = text(spans.eq(1));
  });
  if (specs["Listing ID"] !== existing.sourceListingId)
    throw new Error("ClassicCars detail/ad identity mismatch");
  const description = text($(".p-description"));
  const heading = text($("h1"));
  const offsite =
    /not\s+in\s+cadillac|vehicle location is at our|off.?site|client.?s? home/i.test(
      description,
    );
  const rawPrice = specs.Price ?? "";
  const ask = price(rawPrice);
  const auction = /auction/i.test(heading + rawPrice);
  const photos = $('meta[property="og:image"]')
    .map((_, e) => $(e).attr("content"))
    .get()
    .filter(Boolean);
  const imageCount = new Set(
    $('.vehicle-details meta[itemprop="image"]')
      .map((_, e) => $(e).attr("content"))
      .get(),
  ).size;
  const flags = [
    "Driving time unavailable",
    "Seller claims have not been independently verified",
  ];
  if (offsite)
    flags.push(
      "Actual vehicle location differs from seller location and is unresolved",
    );
  if (specs.Odometer === "0")
    flags.push("Advertised odometer 0 is not proof of zero or actual mileage");
  if (/^0{5,}/.test(specs.VIN ?? ""))
    flags.push("Placeholder identifier; do not use for automatic grouping");
  if (auction) flags.push("Auction timing/current bid/outcome unresolved");
  return {
    ...existing,
    sourceUrl: url,
    rawSpecifications: specs,
    originalSellerExcerpt: excerpt(description),
    price: ask,
    saleType: auction
      ? "auction"
      : ask.askingPrice !== null || ask.priceOnRequest
        ? "fixed"
        : "unknown",
    availability: /^For Sale:/.test(heading) ? "active" : "unknown",
    advertisedLocation: specs.Location ?? null,
    vehicleLocation: {
      label: offsite ? null : (specs.Location ?? null),
      precision: offsite ? "unknown" : "city",
      status: offsite ? "explicitly_off_site_unknown" : "seller_claimed",
      country: "US",
    },
    sellerLocation: {
      label: specs.Location ?? null,
      precision: "city",
      country: "US",
    },
    seller: {
      name:
        text($('#seller-information [aria-label="Seller or Company Name"]')) ||
        null,
      type: $('#seller-information a[href*="/listings/dealer/"]').length
        ? "dealer"
        : "private",
    },
    transmission: specs.Transmission ?? null,
    exteriorColor: specs["Exterior Color"] ?? null,
    interiorColor: specs["Interior Color"] ?? null,
    stockNumber: specs["Stock Number"] ?? null,
    identifier: specs.VIN ?? null,
    mileage: {
      reading:
        specs.Odometer && /^[\d,]+$/.test(specs.Odometer)
          ? Number(specs.Odometer.replaceAll(",", ""))
          : null,
      advertised: specs.Odometer ?? null,
      units: "mi",
      status: "unknown",
    },
    photos: photos.length ? [...new Set(photos)] : existing.photos,
    photoCount: imageCount,
    authenticity: /\btribute\b|\breplica\b|\bclone\b/i.test(description)
      ? { type: "tribute_or_replica", evidence: "seller_claimed" }
      : existing.authenticity,
    lastObservedAt: observedAt,
    lastNetworkCheckedAt: observedAt,
    enrichment: "detail_observed",
    dataFlags: flags,
    evidence: {
      ...existing.evidence,
      detail: evidenceRef,
      selector:
        ".vehicle-details li direct child spans; intentionally ignores unreliable detail JSON-LD",
    },
  };
}

export function parseAutotraderState(html) {
  const $ = load(html);
  const next = $("#__NEXT_DATA__").text();
  if (!next)
    throw new Error(
      "Autotrader public Next state missing; do not use disallowed internal service endpoint",
    );
  const payload = JSON.parse(next);
  const props = payload.props?.pageProps;
  if (!props?.__eggsState) throw new Error("Autotrader source state changed");
  return { state: props.__eggsState, props, $ };
}
export function parseAutotraderCatalog(html, { url, observedAt, evidenceRef }) {
  const { state, props, $ } = parseAutotraderState(html);
  const results = state.srp_results;
  if (!results || results.fetchError)
    throw new Error("Autotrader result state reports failure");
  // Inventory can also contain off-filter sponsored/nearby stock: only activeResults are actual query matches.
  const uniqueIds = [...new Set(results.activeResults ?? [])];
  const listings = uniqueIds.map((id) => {
    const item = state.inventory?.[String(id)];
    if (!item || String(item.id) !== String(id))
      throw new Error(`Autotrader inventory identity mismatch ${id}`);
    const seller = state.owners?.[String(item.ownerId)] ?? {};
    const address = seller.location?.address ?? seller.address ?? {};
    const city = address.city ?? seller.location?.city ?? null;
    const region = address.state ?? seller.location?.state ?? null;
    const claimed =
      [city, region].filter(Boolean).join(", ") ||
      item.titleLong?.match(
        /Mustang\s+(?:GT\s+|LX\s+)?(.+\s[A-Z]{2})\s\d{5}$/,
      )?.[1] ||
      null;
    const virtual = Boolean(
      item.marketExtension?.isVirtualDealer ||
      item.marketExtension?.isMarketExtListing,
    );
    const amount =
      typeof item.pricingDetail?.salePrice === "number"
        ? item.pricingDetail.salePrice
        : null;
    const sourceUrl = item.vdpBaseUrl
      ? abs(item.vdpBaseUrl, url)
      : abs(`/cars-for-sale/vehicle/${id}`, url);
    return {
      sourceId: "autotrader",
      sourceListingId: String(id),
      sourceUrl,
      title: item.title,
      make: item.make?.name ?? null,
      model: modelFamily(item.model?.name ?? item.title ?? ""),
      modelYear: item.year ?? null,
      advertisedModelYear: item.year ? String(item.year) : null,
      originalSellerExcerpt: excerpt(item.description?.label ?? ""),
      price: {
        askingPrice: amount,
        currency: "USD",
        raw:
          amount === null
            ? (item.pricingDetail?.noPriceLabel ?? null)
            : `$${amount}`,
        currentBid: null,
        buyItNow: null,
        priceValidUntil: item.pricingDetail?.priceValidUntil ?? null,
      },
      saleType: "fixed",
      availability: "unknown",
      seller: { name: item.ownerName ?? seller.name ?? null, type: "dealer" },
      sellerLocation: { label: claimed, precision: "city", country: "US" },
      vehicleLocation: {
        label: virtual ? null : claimed,
        precision: virtual ? "unknown" : "city",
        status: virtual
          ? "virtual_or_market_extension_stock_unresolved"
          : "unverified_catalog_location",
      },
      photos: (item.images?.sources ?? []).map((x) => x.src).filter(Boolean),
      transmission: item.transmission?.name ?? null,
      identifier: item.vin ?? null,
      stockNumber: item.stockId ?? null,
      exteriorColor: item.color?.exteriorColor ?? null,
      mileage: {
        advertised: item.mileage?.value ?? null,
        reading:
          item.mileage?.value && /^[\d,]+$/.test(item.mileage.value)
            ? Number(item.mileage.value.replaceAll(",", ""))
            : null,
        units: "mi",
        status: "unknown",
      },
      rawSpecifications: item.specifications ?? {},
      lastObservedAt: observedAt,
      lastNetworkCheckedAt: observedAt,
      sellerPostedAt: null,
      driveMinutes: null,
      enrichment: "pending",
      dataFlags: [
        "Detail enrichment pending",
        "Driving time unavailable",
        "Seller claims have not been independently verified",
        ...(item.pricingDetail?.priceValidUntil &&
        item.pricingDetail.priceValidUntil < observedAt.slice(0, 10)
          ? [
              "Source price-valid-until date is in the past; reconfirm asking price",
            ]
          : []),
      ],
      evidence: {
        catalog: evidenceRef,
        selector:
          "public __NEXT_DATA__; activeResults IDs joined to inventory and ownerId joined to owners",
        observedQuery: props.query,
      },
    };
  });
  // Follow only actual public anchor links from the page; never reconstruct disallowed /svc requests.
  const current = Number(new URL(url).searchParams.get("page") ?? 1);
  const pageLinks = [
    ...new Set(
      $("a[href]")
        .map((_, e) => $(e).attr("href"))
        .get()
        .map((href) => {
          try {
            return abs(href, url);
          } catch {
            return null;
          }
        })
        .filter(
          (href) =>
            href &&
            new URL(href).origin === new URL(url).origin &&
            new URL(href).pathname.includes("/cars-for-sale/") &&
            Number(new URL(href).searchParams.get("page")) > current,
        ),
    ),
  ];
  return {
    listings,
    sourceReportedCount: results.count,
    pageLinks,
    query: props.query,
    errors: [],
  };
}

export function enrichAutotraderDetail(
  html,
  existing,
  { url, observedAt, evidenceRef },
) {
  const { state, $ } = parseAutotraderState(html);
  const ids = state.vdp_results?.activeResults ?? [];
  const id = existing.sourceListingId;
  if (!ids.some((x) => String(x) === id) || !state.inventory?.[id])
    throw new Error(
      "Autotrader detail/ad identity mismatch or unavailable detail",
    );
  const item = state.inventory[id];
  const amount = item.pricingDetail?.salePrice;
  const title = text($("h1")) || existing.title;
  const unavailable =
    /no longer available|listing expired|vehicle has been sold/i.test(title);
  return {
    ...existing,
    title,
    sourceUrl: url,
    price: {
      ...existing.price,
      askingPrice:
        typeof amount === "number" ? amount : existing.price.askingPrice,
    },
    originalSellerExcerpt: excerpt(
      item.description?.label ?? existing.originalSellerExcerpt,
    ),
    availability: unavailable ? "unknown" : "active",
    enrichment: "detail_observed",
    photos:
      item.images?.sources?.map((x) => x.src).filter(Boolean) ??
      existing.photos,
    vehicleLocation: {
      ...existing.vehicleLocation,
      status:
        existing.vehicleLocation.status === "unverified_catalog_location"
          ? "seller_claimed"
          : existing.vehicleLocation.status,
    },
    lastObservedAt: observedAt,
    lastNetworkCheckedAt: observedAt,
    dataFlags: existing.dataFlags.filter(
      (x) => x !== "Detail enrichment pending",
    ),
    evidence: {
      ...existing.evidence,
      detail: evidenceRef,
      detailSelector:
        "public __NEXT_DATA__; vdp_results.activeResults checked against inventory ID",
    },
  };
}
