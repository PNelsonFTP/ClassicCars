import {
  parseAutotraderCatalog,
  enrichAutotraderDetail,
} from "./marketplace-parsers.mjs";
import { normalizeObserved } from "./normalize";
import * as cheerio from "cheerio";
import { listingSchema, type Listing } from "../../shared/schema";
import { identify, generation } from "../../shared/search";
export type SourceConfig = {
  id: string;
  name: string;
  url: string;
  category: string;
  status: string;
  scope: string;
  note: string;
  enabled?: boolean;
  origins?: string[];
  inventory?: string[];
  nationwideInventory?: string[];
  delayMs?: number;
  detailMode?: "catalog-only";
};
export type PageContext = {
  url: string;
  observedAt: string;
  lastNetworkCheckedAt: string;
  hash: string;
  scope: "regional" | "nationwide";
};
export type ParsedPage = {
  listings: Listing[];
  next: string[];
  discovered: number;
};
const clean = (s: string | undefined) => s?.replace(/\s+/g, " ").trim() || "";
export function parseAsk(s: string) {
  if (/month|\/mo|payment|deposit|bid|auction/i.test(s)) return null;
  const m = s.match(/\$\s*([\d,]+(?:\.\d{2})?)/);
  const amount = m ? Number(m[1].replace(/,/g, "")) : null;
  return amount !== null && Number.isFinite(amount) && amount > 0
    ? amount
    : null;
}
const absolute = (u: string | undefined, base: string) => {
  try {
    if (!u || u.includes("{") || /ina_|nophoto/i.test(u)) return null;
    const url = new URL(u, base);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};
const places: Record<string, [string, string]> = {
  volo: ["Volo", "IL"],
  admcars: ["Des Moines", "IA"],
  midwest: ["Lake Zurich", "IL"],
  jsmotors: ["Fairmount", "IN"],
  nsclassics: ["Mundelein", "IL"],
  "500classic": ["Knightstown", "IN"],
  jws: ["Greendale", "WI"],
};
function baseListing(
  source: SourceConfig,
  ctx: PageContext,
  id: string,
  title: string,
  url: string,
  askingPrice: number | null,
  photos: string[],
  extra: Partial<Listing> = {},
): Listing {
  const identity = identify(title),
    loc = places[source.id];
  let specialty: Listing["specialty"] = null;
  if (identity.model === "Mustang") {
    if (
      /\bSVT\b|\bCobra\b/i.test(title) &&
      identity.year &&
      identity.year >= 1993 &&
      identity.year <= 2004
    )
      specialty = "SVT/Cobra";
    else if (/Shelby|GT[ -]?(350|500)/i.test(title))
      specialty = "Shelby GT350/GT500";
    else if (/Mach\s*1/i.test(title)) specialty = "Mach 1";
    else if (/\bBoss\b/i.test(title)) specialty = "Boss";
    else if (/\bGTD\b/i.test(title)) specialty = "GTD";
  }
  return listingSchema.parse({
    id: `${source.id}:${id}`,
    sourceId: source.id,
    sourceName: source.name,
    sourceListingId: id,
    url,
    title,
    originalSellerText: title,
    ...identity,
    make:
      identity.model === "Mustang"
        ? "Ford"
        : identity.model
          ? "Chevrolet"
          : null,
    generation: generation(identity),
    specialty,
    specialtyEvidence: specialty ? "seller-claimed" : "unknown",
    authenticity: /tribute/i.test(title)
      ? "tribute"
      : /clone/i.test(title)
        ? "clone"
        : /replica/i.test(title)
          ? "replica"
          : "unknown",
    askingPrice,
    saleType: "fixed",
    availability: "active",
    photos,
    seller: {
      name: source.name,
      type: source.id === "midwest" ? "consignment" : "dealer",
      location: loc ? { city: loc[0], state: loc[1], precision: "city" } : null,
    },
    vehicleLocation: null,
    description:
      "Seller-advertised vehicle. Detailed condition, authenticity and actual stock location require review.",
    flags: [
      "Detail enrichment pending",
      "Seller claims not independently verified",
    ],
    routeUnknownReason:
      "Actual vehicle location has not yet been established from detail evidence.",
    firstSeenAt: ctx.observedAt,
    lastObservedAt: ctx.observedAt,
    lastNetworkCheckedAt: ctx.lastNetworkCheckedAt,
    evidenceRef: ctx.hash,
    parserVersion: `${source.id}-v1`,
    scope: ctx.scope,
    ...extra,
  });
}
function targetCandidate(l: Listing) {
  return (
    !!l.model &&
    (l.year == null ||
      (l.year >= 1960 && l.year <= 1989) ||
      (l.model === "Mustang" && !!l.specialty))
  );
}
export function parseInventory(
  html: string,
  source: SourceConfig,
  ctx: PageContext,
): ParsedPage {
  const $ = cheerio.load(html, { scriptingEnabled: false });
  $("br").replaceWith(" ");
  const rows: Listing[] = [];
  let discovered = 0;
  const add = (l: Listing) => {
    discovered++;
    if (targetCandidate(l)) rows.push(l);
  };
  const photo = (
    c: cheerio.Cheerio<import("domhandler").AnyNode>,
    selector = "img",
  ) => {
    const i = c.find(selector).first();
    return absolute(i.attr("data-src") || i.attr("src"), ctx.url);
  };
  if (source.id === "classiccars")
    $(".search-result-item").each((_, el) => {
      const c = $(el),
        a = c.find('a[href*="/listings/view/"]').first(),
        url = absolute(a.attr("href"), ctx.url),
        id = url?.match(/\/view\/(\d+)\//)?.[1];
      if (!id || !url) return;
      let structured: Record<string, unknown> = {};
      try {
        structured = JSON.parse(
          c.find('script[type="application/ld+json"]').text(),
        );
      } catch {}
      if (structured.sku && structured.sku !== `CC-${id}`) return;
      const title = clean(c.find(".h-sri-car-title").text()),
        p = clean(c.find(".mrg-b-sri-price").text()),
        img = photo(c);
      const location = (a.attr("aria-label") || "").split(" for sale in ")[1];
      add(
        baseListing(
          source,
          ctx,
          `CC-${id}`,
          title,
          url,
          parseAsk(p),
          img ? [img] : [],
          {
            priceOnRequest:
              /call|request/i.test(p) || /\$\s*0(?:\.0+)?(?:\s|$)/.test(p),
            saleType: /auction/i.test(p)
              ? "auction"
              : /obo/i.test(p)
                ? "negotiable"
                : parseAsk(p) != null
                  ? "fixed"
                  : "unknown",
            availability: "unknown",
            seller: {
              name: "Seller detail pending",
              type: "unknown",
              location: location ? parseLocation(location) : null,
            },
            flags: [
              "Catalog observation; availability and actual vehicle location need detail review",
            ],
          },
        ),
      );
    });
  else if (source.id === "volo")
    $(".volo-sales-list-grid-item").each((_, el) => {
      const c = $(el),
        url = absolute(
          c.find('a[href*="/vehicles/"]').first().attr("href"),
          ctx.url,
        ),
        id = url?.match(/\/vehicles\/(\d+)\//)?.[1];
      if (!id || !url || /RENTAL/i.test(c.text())) return;
      const title = clean(
          c.find(".volo-thumb-name h2").text() +
            " " +
            c.find(".volo-thumb-name h1").text(),
        ),
        banner = clean(c.find(".volo-vehicle-thumb-banner").text());
      let photos: string[] = [];
      try {
        photos = JSON.parse(
          c.find("[data-images-src]").attr("data-images-src") || "[]",
        );
      } catch {}
      const specs: Listing["specs"] = {};
      let stock: string | null = null;
      c.find(".volo-engine-trans-thumb span").each((_, s) => {
        const text = clean($(s).text()),
          value = clean($(s).find("i").text());
        if (/Stock/.test(text)) stock = value;
        else if (value)
          specs[/Engine/.test(text) ? "engineInstalled" : "transmission"] = {
            value,
            basis: "seller-claimed",
          };
      });
      add(
        baseListing(
          source,
          ctx,
          id,
          title,
          url,
          parseAsk(c.find(".only-price").text()),
          photos.filter((p) => absolute(p, ctx.url)),
          {
            availability: /sold/i.test(banner)
              ? "sold"
              : /pending/i.test(banner)
                ? "pending"
                : /incoming/i.test(banner)
                  ? "unknown"
                  : "active",
            specs,
            stockNumber: stock,
            statusEvidence: banner || "Listed on active dealer inventory",
          },
        ),
      );
    });
  else if (source.id === "grauto")
    $('a[itemtype="https://schema.org/Car"]').each((_, el) => {
      const c = $(el),
        url = absolute(c.attr("href"), ctx.url),
        id = url?.match(/\/vehicles\/([^/]+)\//)?.[1];
      if (!id || !url) return;
      const values: Record<string, string> = {};
      c.find(".ag-list-item-details li").each((_, li) => {
        values[clean($(li).find("strong").text()).replace(/:$/, "")] = clean(
          $(li).find("p").text(),
        );
      });
      const img = photo(c),
        branches: Record<string, [string, string]> = {
          "Metro Detroit": ["Commerce Township", "MI"],
          "Grand Rapids": ["Kentwood", "MI"],
          "Traverse City": ["Traverse City", "MI"],
          Indianapolis: ["Plainfield", "IN"],
        },
        branch = branches[values.Location];
      add(
        baseListing(
          source,
          ctx,
          id,
          clean(c.find(".ag-list-item-title").text()),
          url,
          parseAsk(c.find(".price").text()),
          img ? [img] : [],
          {
            stockNumber: id.toUpperCase(),
            seller: {
              name: source.name,
              type: "dealer",
              location: branch ? parseLocation(branch.join(", ")) : null,
            },
            specs: specsFrom({
              Engine: values["Engine Size"],
              Transmission: values.Transmission,
              Odometer: values.Mileage,
            }),
          },
        ),
      );
    });
  else if (source.id === "admcars")
    $(".search-results-item").each((_, el) => {
      const c = $(el),
        url = absolute(
          c
            .attr("onclick")
            ?.match(/'(https:\/\/www\.admcars\.com\/[^']+)'/)?.[1],
          ctx.url,
        ),
        id = url?.match(/-c-(\d+)\.htm/)?.[1];
      if (!id || !url) return;
      const img = photo(c);
      add(
        baseListing(
          source,
          ctx,
          id,
          clean(c.find(".car_name_inventory_class").text()),
          url,
          parseAsk(c.find(".search-results-price").text()),
          img ? [img] : [],
          { priceOnRequest: !!c.find(".search-results-price-call").length },
        ),
      );
    });
  else if (source.id === "midwest")
    $(".listing[id]").each((_, el) => {
      const c = $(el),
        a = c.find("a.listing-title"),
        url = absolute(a.attr("href"), ctx.url),
        id = c.attr("id")?.replace("listing-", "");
      if (!url || !id) return;
      const img = photo(c, "noscript img") || photo(c);
      add(
        baseListing(
          source,
          ctx,
          id,
          clean(a.text()),
          url,
          null,
          img ? [img] : [],
        ),
      );
    });
  else if (source.id === "jsmotors")
    $(".product-card").each((_, el) => {
      const c = $(el),
        a = c.find('a[href^="/products/"]').first(),
        url = absolute(a.attr("href"), ctx.url),
        id = a.attr("href")?.split("/").pop();
      if (!url || !id) return;
      const img = photo(c, "noscript img") || photo(c),
        ask = parseAsk(c.find(".price-item--regular").text());
      add(
        baseListing(
          source,
          ctx,
          id,
          clean(c.find(".product-card__title").text()),
          url,
          ask || null,
          img ? [img] : [],
          {
            availability: c.find(".price--sold-out").length ? "sold" : "active",
          },
        ),
      );
    });
  else if (source.id === "nsclassics")
    $(".inventory-card").each((_, el) => {
      const c = $(el),
        url = absolute(
          c.attr("onclick")?.match(/getDetailed\('([^']+)'\)/)?.[1],
          ctx.url,
        ),
        id = url?.match(/-c-(\d+)\//)?.[1];
      if (!url || !id) return;
      const img = photo(c);
      add(
        baseListing(
          source,
          ctx,
          id,
          clean(c.find(".single-car-name > p").first().text()),
          url,
          parseAsk(c.find(".single-car-name h4").last().text()),
          img ? [img] : [],
        ),
      );
    });
  else if (source.id === "jws") {
    // The headings, not a whole-page "sold" search, establish card state.
    // Only the site's observed legacy HTTP links are upgraded to HTTPS.
    const sections = $("section").filter((_, el) =>
      /^(Current Inventory|Recently Sold)$/.test(
        clean($(el).find("h2").first().text()),
      ),
    );
    if (sections.length !== 2)
      throw new Error(
        "JWS inventory sections unrecognized; empty stock cannot be established.",
      );
    sections.each((_, section) => {
      const sold =
        clean($(section).find("h2").first().text()) === "Recently Sold";
      $(section)
        .find('a[href*="/detail/?id="]')
        .each((_, el) => {
          const card = $(el);
          const url = new URL(card.attr("href")!, ctx.url);
          if (
            url.hostname !== "www.jwsclassics.com" ||
            url.port ||
            url.username ||
            url.password ||
            url.pathname !== "/detail/"
          )
            return;
          const id = url.searchParams.get("id");
          if (
            !id ||
            !/^\d+$/.test(id) ||
            [...url.searchParams.keys()].some((k) => k !== "id")
          )
            return;
          url.protocol = "https:";
          const imagePath = card
            .find(".imagecar")
            .attr("style")
            ?.match(/background-image:\s*url\(([^)]+)\)/i)?.[1];
          const img = imagePath?.match(
            /^http:\/\/www\.jwsclassics\.com\/img-primary\/[\w.-]+$/,
          )
            ? imagePath.replace(/^http:/, "https:")
            : absolute(imagePath, ctx.url);
          add(
            baseListing(
              source,
              ctx,
              id,
              clean(card.text()),
              url.href,
              null,
              img ? [img] : [],
              {
                availability: sold ? "sold" : "active",
                saleType: "unknown",
                statusEvidence: sold
                  ? "Dealer catalog: Recently Sold"
                  : "Dealer catalog: Current Inventory",
                flags: [
                  "Catalog-only observation; dealer detail endpoint returns HTTP 500",
                  "Asking price not supplied by catalog",
                ],
              },
            ),
          );
        });
    });
  } else if (source.id === "500classic")
    $(".vehicle-snapshot").each((_, el) => {
      const c = $(el),
        a = c.find(".vehicle-snapshot__title a"),
        url = absolute(a.attr("href"), ctx.url),
        id = url?.split("/").pop();
      if (!url || !id) return;
      const img = photo(c),
        p = clean(
          c
            .find(".vehicle-snapshot__main-info-item")
            .filter((_, x) =>
              /Price/.test($(x).find(".vehicle-snapshot__label").text()),
            )
            .find(".vehicle-snapshot__main-info")
            .text(),
        );
      add(
        baseListing(
          source,
          ctx,
          id,
          clean(a.text() + " " + c.find(".vehicle-snapshot__style").text()),
          url,
          parseAsk(p),
          img ? [img] : [],
          {
            availability: /sold/i.test(p) ? "sold" : "active",
            flags: [
              "Only first-page collection supported. Detail request returned 403; no bypass.",
            ],
          },
        ),
      );
    });
  else if (source.id === "autotrader") {
    const parsed = parseAutotraderCatalog(html, {
      url: ctx.url,
      observedAt: ctx.observedAt,
      evidenceRef: ctx.hash,
    });
    for (const raw of parsed.listings)
      add(
        normalizeObserved(
          {
            ...raw,
            scope: ctx.scope,
            evidenceRef: ctx.hash,
            firstSeenAt: ctx.observedAt,
          },
          source.name,
        ),
      );
    return {
      listings: rows,
      next: parsed.pageLinks.filter((v): v is string => typeof v === "string"),
      discovered,
    };
  }
  const next: string[] = [];
  $('link[rel="next"], a[rel="next"], .pagination a[href]').each((_, a) => {
    const href = $(a).attr("href");
    if (!href || href === "#" || $(a).parent().hasClass("disabled")) return;
    const url = absolute(href, ctx.url);
    if (
      url &&
      new URL(url).origin === new URL(ctx.url).origin &&
      url !== ctx.url
    )
      next.push(url);
  });
  if (source.id === "admcars" || source.id === "nsclassics") {
    const increment = source.id === "admcars" ? 25 : 24,
      offset = Number(new URL(ctx.url).searchParams.get("offset") || 0),
      total = Number(
        html.match(/^\s*(\d+)\s*[\r\n]/)?.[1] ||
          html.match(/totalcars\s*=\s*(\d+)/)?.[1] ||
          0,
      );
    if (offset + increment < total) {
      const url =
        source.id === "admcars"
          ? `https://www.admcars.com/isapi_xml.php?module=inventory&offset=${offset + increment}&sold=Available&orderby=price,desc`
          : `https://www.nsclassics.com/isapi_xml.php?module=inventory&pageID=741&main=&limit=24&orderby=year,make,model&offset=${offset + increment}`;
      next.push(url);
    }
  }
  if (
    discovered === 0 &&
    !/no vehicles|no results|0 vehicles|no products/i.test($.text())
  )
    throw new Error(
      "Inventory layout unrecognized; zero stock cannot be established.",
    );
  const unique = new Map<string, Listing>();
  for (const l of rows) {
    const old = unique.get(l.id);
    unique.set(
      l.id,
      old
        ? {
            ...l,
            ...old,
            askingPrice: old.askingPrice ?? l.askingPrice,
            photos: old.photos.length ? old.photos : l.photos,
            specs: { ...l.specs, ...old.specs },
          }
        : l,
    );
  }
  return {
    listings: [...unique.values()],
    next: [...new Set(next)],
    discovered,
  };
}
const stateCodes: Record<string, string> = {
  illinois: "IL",
  wisconsin: "WI",
  indiana: "IN",
  michigan: "MI",
  iowa: "IA",
  ohio: "OH",
  missouri: "MO",
  minnesota: "MN",
  kentucky: "KY",
  tennessee: "TN",
  florida: "FL",
  california: "CA",
  texas: "TX",
  arizona: "AZ",
  pennsylvania: "PA",
  "new york": "NY",
  colorado: "CO",
  oklahoma: "OK",
  kansas: "KS",
  nebraska: "NE",
  arkansas: "AR",
  alabama: "AL",
  georgia: "GA",
  "north carolina": "NC",
  "south carolina": "SC",
  virginia: "VA",
  maryland: "MD",
  washington: "WA",
  oregon: "OR",
  massachusetts: "MA",
  connecticut: "CT",
  "new jersey": "NJ",
  nevada: "NV",
  utah: "UT",
  idaho: "ID",
  "new mexico": "NM",
  louisiana: "LA",
  mississippi: "MS",
  maine: "ME",
  "new hampshire": "NH",
  vermont: "VT",
  "rhode island": "RI",
  delaware: "DE",
  "west virginia": "WV",
  "south dakota": "SD",
  "north dakota": "ND",
  montana: "MT",
  wyoming: "WY",
  alaska: "AK",
  hawaii: "HI",
};
export function parseLocation(text: string) {
  const parts = text.split(",").map(clean),
    raw = (parts[1] || "").replace(/\d/g, "").trim(),
    state =
      stateCodes[raw.toLowerCase()] || (/^[A-Z]{2}$/.test(raw) ? raw : "");
  return {
    city: parts[0] || "",
    state,
    country: "US",
    precision: state && parts[0] ? ("city" as const) : ("ambiguous" as const),
    offsite: false,
  };
}
export function specsFrom(values: Record<string, string | undefined>) {
  const map: Record<string, string> = {
    Engine: "engineInstalled",
    Exterior: "exteriorColor",
    Interior: "interiorColor",
    "Body Type": "bodyStyle",
    "Engine Size": "engineInstalled",
    Transmission: "transmission",
    "Transmission Type": "transmission",
    "Body Color": "exteriorColor",
    "Odometer Reading": "odometer",
    Trans: "transmission",
    "Exterior Color": "exteriorColor",
    "Ext Color": "exteriorColor",
    "Interior Color": "interiorColor",
    "Int Color": "interiorColor",
    "Body Style": "bodyStyle",
    Body: "bodyStyle",
    Odometer: "odometer",
    Mileage: "odometer",
  };
  const result: Listing["specs"] = {};
  for (const [k, v] of Object.entries(values)) {
    if (!v || !map[k]) continue;
    result[map[k]] = { value: v, basis: "seller-claimed" };
    if (map[k] === "odometer")
      result.mileageStatus = {
        value: "Unknown; advertised odometer is not proof of actual mileage",
        basis: "unknown",
      };
  }
  return result;
}
export function detailUrl(l: Listing) {
  return l.sourceId === "nsclassics"
    ? `https://www.nsclassics.com/isapi_xml.php?module=detailed&action=getPage&vid=${encodeURIComponent(l.sourceListingId)}`
    : l.url;
}
function canonicalMatchesListing(canonical: string, l: Listing) {
  const resolved = absolute(canonical, l.url);
  if (resolved?.replace(/\/$/, "") === l.url.replace(/\/$/, "")) return true;
  if (l.sourceId !== "admcars" || !resolved) return false;
  const requested = new URL(l.url),
    actual = new URL(resolved);
  // ADM catalog links append this observed inventory filter; the canonical
  // omits it. No origin, path, ad identity, or other query difference is ignored.
  if (
    requested.origin !== "https://www.admcars.com" ||
    actual.origin !== requested.origin ||
    actual.pathname !== requested.pathname ||
    requested.pathname.match(/-c-(\d+)\.htm$/)?.[1] !== l.sourceListingId ||
    requested.searchParams.getAll("sold").length !== 1 ||
    requested.searchParams.get("sold") !== "Available"
  )
    return false;
  requested.searchParams.delete("sold");
  return requested.href === actual.href;
}
export function parseDetail(
  html: string,
  l: Listing,
  ctx: PageContext,
): Listing {
  if (l.sourceId === "autotrader") {
    const raw = {
      ...l,
      sourceUrl: l.url,
      price: { askingPrice: l.askingPrice },
      originalSellerExcerpt: l.originalSellerText,
      dataFlags: l.flags,
      evidence: {},
      sellerLocation: l.seller.location,
      vehicleLocation: l.vehicleLocation
        ? { ...l.vehicleLocation, status: "seller_claimed" }
        : {
            label: l.seller.location
              ? `${l.seller.location.city}, ${l.seller.location.state}`
              : null,
            status: "unverified_catalog_location",
          },
    };
    const enriched = enrichAutotraderDetail(html, raw, {
      url: l.url,
      observedAt: ctx.observedAt,
      evidenceRef: ctx.hash,
    });
    return {
      ...normalizeObserved(enriched, l.sourceName),
      firstSeenAt: l.firstSeenAt,
      groupId: l.groupId,
      evidenceRef: ctx.hash,
      lastDetailObservedAt: ctx.observedAt,
    };
  }
  const $ = cheerio.load(html, { scriptingEnabled: false });
  $("br").replaceWith(" ");
  const values: Record<string, string> = {};
  let description = "";
  if (l.sourceId === "classiccars") {
    $(".vehicle-details li").each((_, el) => {
      const spans = $(el).children("span");
      if (spans.length >= 2)
        values[clean(spans.eq(0).text()).replace(/:$/, "")] = clean(
          spans.eq(1).text(),
        );
    });
    if (values["Listing ID"] !== l.sourceListingId)
      throw new Error(
        "ClassicCars detail identity does not match the requested ad.",
      );
    description = clean(
      $(
        '.p-description,#description,.vehicle-description,[itemprop="description"]',
      )
        .first()
        .text(),
    );
  } else if (l.sourceId === "nsclassics") {
    if (!$(`[data-pin="${l.sourceListingId}"]`).length)
      throw new Error("North Shore detail identity not found.");
    $(".car-details li").each((_, el) => {
      const label = $(el).find(".divfirst").first();
      values[clean(label.text()).replace(/:$/, "")] = clean(
        label.next("div").text(),
      );
    });
    values.Price = clean(
      $(".invent-detail-price h3")
        .filter((_, el) => /Our Price:/i.test($(el).text()))
        .last()
        .text(),
    );
    description = clean($("#pane-A .card-body").first().text());
  } else if (l.sourceId === "midwest") {
    $("table.listing-info tr").each((_, tr) => {
      const cells = $(tr).children("th,td");
      for (let i = 0; i + 1 < cells.length; i += 2)
        values[clean(cells.eq(i).text()).replace(/:$/, "")] = clean(
          cells.eq(i + 1).text(),
        );
    });
    description = clean(
      $(".listing-content,.listing-description").first().text(),
    );
  } else if (l.sourceId === "admcars") {
    $("#details .datatable dl").each((_, dl) => {
      values[clean($(dl).find("dt").text()).replace(/:$/, "")] = clean(
        $(dl).find("dd").text(),
      );
    });
    description = clean($("#stock_options").text());
  } else if (l.sourceId === "volo" || l.sourceId === "grauto") {
    const selector =
      l.sourceId === "volo"
        ? ".volo-header-specs dl.show-car-details"
        : ".ag-specs-summary-container dl.show-car-details";
    $(selector).each((_, dl) => {
      const cells =
        l.sourceId === "grauto" ? $(dl).find("dt,dd") : $(dl).children("dt,dd");
      for (let i = 0; i + 1 < cells.length; i += 2)
        values[clean(cells.eq(i).text()).replace(/:$/, "")] = clean(
          cells.eq(i + 1).text(),
        );
      if (l.sourceId === "grauto") {
        const price = clean(
          $(dl).find(".ag-price .vehicle-price h2").first().text(),
        );
        if (price) values.Price = price;
      }
    });
    description =
      l.sourceId === "volo"
        ? clean($("div.volo-details-col").first().text())
        : clean(
            $('[itemprop="description"]').first().parent(".tab-pane").text() ||
              $('[itemprop="description"]').first().text(),
          );
  } else {
    description = clean(
      $(
        '[itemprop="description"],.vehicle-description,.product-single__description',
      )
        .first()
        .text(),
    );
  }
  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical && !canonicalMatchesListing(canonical, l))
    throw new Error("Detail canonical identity does not match requested ad.");
  if (
    ["midwest", "admcars", "volo", "grauto"].includes(l.sourceId) &&
    Object.keys(values).length < 2
  )
    throw new Error(
      "Detail layout unavailable; vehicle fields were not found.",
    );
  if (
    l.sourceId === "grauto" &&
    values.Stock &&
    values.Stock.toLowerCase() !== l.sourceListingId.toLowerCase()
  ) {
    // The observed B6309 B label uses spaces for URL-ID hyphens. Accept that
    // formatting only when this page independently names the exact requested URL.
    const equivalentStock =
      values.Stock.toLowerCase().replace(/\s+/g, "-") ===
      l.sourceListingId.toLowerCase();
    const exactVehicleUrl = $('input[name="redirect_to"]')
      .toArray()
      .some((el) => absolute($(el).attr("value"), l.url) === l.url);
    if (!equivalentStock || !exactVehicleUrl)
      throw new Error("Detail stock identity mismatch.");
  }
  if (
    l.sourceId === "nsclassics" &&
    !description &&
    // Some populated ads omit narrative. Exact data-pin identity was checked above;
    // require the ad's own price and multiple vehicle fields before accepting it.
    (parseAsk(values.Price || "") === null ||
      ["Engine", "Transmission", "Interior", "Exterior"].filter((field) =>
        Boolean(values[field]),
      ).length < 2)
  )
    throw new Error(
      "North Shore detail is an unrendered shell; catalog observation retained, enrichment pending.",
    );
  const offsite =
    /not\s+in\s+cadillac|vehicle location is at our|off.?site|client.?s? home|owner.?s? home/i.test(
      description,
    );
  const rawLocation = l.sourceId === "grauto" ? undefined : values.Location;
  let location = l.vehicleLocation;
  if (offsite) location = null;
  else if (rawLocation)
    location = parseLocation(
      l.sourceId === "midwest" && !rawLocation.includes(",")
        ? rawLocation + ", IL"
        : rawLocation,
    );
  else if (l.sourceId === "midwest")
    location = parseLocation("Lake Zurich, IL");
  if (!offsite && l.sourceId === "grauto") {
    const branch = description.match(
      /This vehicle is located at our (.+?) facility/i,
    )?.[1];
    const places: Record<string, string> = {
      "Metro Detroit": "Commerce Township, MI",
      "Grand Rapids": "Kentwood, MI",
      "Traverse City": "Traverse City, MI",
      Indianapolis: "Plainfield, IN",
    };
    if (branch && places[branch]) location = parseLocation(places[branch]);
  }
  const isAuction =
    l.sourceId === "classiccars" &&
    /auction/i.test(values.Price + " " + $("h1").text());
  const ask = isAuction
    ? null
    : values.Price
      ? parseAsk(values.Price)
      : l.sourceId === "admcars"
        ? parseAsk($(".inventory-detailed-internet-price").text())
        : l.askingPrice;
  let photos = l.photos,
    availability = l.sourceAvailability || l.availability;
  if (l.sourceId === "jsmotors") {
    let matchedProduct = false;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const j = JSON.parse($(el).text());
        if (
          j["@type"] === "Product" &&
          j.url?.replace(/\/$/, "") === l.url.replace(/\/$/, "")
        ) {
          matchedProduct = true;
          const offer = Array.isArray(j.offers) ? j.offers[0] : j.offers;
          if (offer) {
            values.Price = `$${offer.price}`;
            availability = /InStock/.test(offer.availability)
              ? "active"
              : /SoldOut|OutOfStock/.test(offer.availability)
                ? "sold"
                : "unknown";
          }
          if (Array.isArray(j.image))
            photos = j.image.filter((p: string) => absolute(p, l.url));
        }
      } catch {}
    });
    if (!matchedProduct)
      throw new Error("Matching product detail identity unavailable.");
  }
  if (l.sourceId === "classiccars") {
    const og = absolute($('meta[property="og:image"]').attr("content"), l.url);
    if (og) photos = [og, ...photos.filter((p) => p !== og)];
    if (/^For Sale:/i.test($("h1").text()))
      availability = /auction/i.test(values.Price || "") ? "unknown" : "active";
  }
  if (l.sourceId === "nsclassics") {
    const detailPhotos = $(`img[src*="/imagetag/${l.sourceListingId}/"]`)
      .map((_, el) => absolute($(el).attr("src"), l.url))
      .get()
      .filter(Boolean) as string[];
    if (detailPhotos.length) photos = [...new Set(detailPhotos)];
  }
  const observedSpecs = specsFrom(values);
  for (const v of Object.values(observedSpecs)) {
    v.sourceUrl = l.url;
    v.observedAt = ctx.observedAt;
  }
  // Retained fields were not reobserved merely because this detail page was fetched.
  const specs = { ...l.specs, ...observedSpecs };
  return listingSchema.parse({
    ...l,
    saleType: isAuction ? "auction" : l.saleType,
    askingPrice:
      l.sourceId === "jsmotors" && values.Price
        ? parseAsk(values.Price) || null
        : ask,
    availability,
    // This detail result is a source observation, not an age-projected display state.
    sourceAvailability: availability,
    photos: photos.slice(0, 100),
    vehicleLocation: location,
    route: offsite ? null : l.route,
    routeUnknownReason: offsite
      ? "Seller explicitly describes an off-site vehicle; actual location must be confirmed."
      : location
        ? "Actual location is seller-claimed; driving route is not yet established."
        : "Actual vehicle location needs review; dealer location is not proof.",
    identifier: values.VIN || values.Vin || l.identifier,
    stockNumber:
      values["Stock Number"] ||
      values["Stock#"] ||
      values.Stock ||
      l.stockNumber,
    specs,
    flags: l.flags
      .filter(
        (f) => !f.includes("pending") && !f.includes("Catalog observation"),
      )
      .concat(offsite ? ["Off-site vehicle location unknown"] : []),
    description: `Seller advertises ${l.title}. ${Object.entries(specs)
      .slice(0, 5)
      .map(([k, v]) => `${k}: ${v.value}`)
      .join("; ")}. Condition and authenticity are unverified.`,
    originalSellerText: description
      ? description.split(" ").slice(0, 20).join(" ")
      : l.originalSellerText,
    lastObservedAt: ctx.observedAt,
    lastNetworkCheckedAt: ctx.lastNetworkCheckedAt,
    evidenceRef: ctx.hash,
    parserVersion: `${l.sourceId}-detail-v1`,
    lastDetailObservedAt: ctx.observedAt,
  });
}
