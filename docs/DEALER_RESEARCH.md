# MuscleScout dealer source research and observed inventory

> **Archived initial research.** Preserve the observed dates and findings below. Consult [current source coverage](../SOURCE_COVERAGE.md), [handoff](../HANDOFF.md) and [SBOM](../SBOM.md) for the final implementation. North Shore and J & S were subsequently integrated; North Shore's permitted detail HTML endpoint was verified after the initial empty shell. Raw evidence is private and is not stored beside this public report; dealer/marketplace evidence is under ignored `data/research/` and later request evidence under `data/cache/`.


Research/network observation window: **2026-09-08 02:29–02:35 UTC** (September 7 evening in America/Chicago). This is a bounded research collection, not proof of complete regional inventory or current mechanical condition. Later cache parsing retains those original timestamps. Data is real seller advertising; claims are not independently verified.

## Deliverables

- `observed-listings.json`: 170 normalized target/classic and explicit later-specialty candidates; stable source IDs; no invented driving times. Includes 162 classic-year records and eight later claimed specialty Mustangs, not all eight belonging to default SVT/Cobra expansion.
- `detail-listings.json`: 19 records whose detail pages were successfully fetched and joined by exact identity.
- `parsing-stats.json`: page/card counts and discovered pagination. Target counts are **ad counts**, not proven physical-vehicle counts.
- `fixtures/`: minimal source card/detail DOM for actual adapter fixture testing. Scripts, forms, general navigation, SVGs and long descriptions removed; `onclick` data may remain solely because it supplies a listing URL. Never execute it.
- `*-results.json`: true HTTP observations with URL, timestamp, response size and errors.
- `*-robots.txt` and `*-robots.html`: observed policies. Requests stopped at actual 403/500 failures; no login, cookies, CAPTCHA or access-control bypass was used.
- Full HTML in this private temporary directory is raw private parsing evidence. **Do not publish it, local privateEvidencePath fields, VINs, contact fields or raw HTML in snapshots.** Public photo URLs originate from the corresponding card/detail; known generic ADM placeholder images were removed.
- `normalize.py`: reproducible cache-only prototype parser that produced these records, with no fresh network requests. This is research code, not the hardened production adapter.

## Coverage and feasibility

| Dealer | Location/scope | Access/pagination actually verified | Target candidates retained | Detail fetched | Result |
|---|---|---|---:|---:|---|
| [Volo Museum Auto Sales](https://www.volocars.com/vehicles) | Volo, IL | HTTP 200 inventory pages 1–2, terminal pagination disabled on page 2; 362 distinct vehicle links scanned, including museum/rental and sold material that must be excluded or separately labeled. Six target details 200. | 50: 40 active, six incoming/unknown, four sold | 6 | Viable, inventory traversal complete for this endpoint; target enrichment partial |
| [GR Auto Gallery](https://www.grautogallery.com/vehicles) | MI/IN branches | HTTP 200 pages 1–5; 518 cards across pages, 500 unique URLs; repeated IDs must be deduplicated. Terminal page 5 verified. Five target details 200. | 44: 36 classic-year and eight explicit later specialty-claim Mustangs | 5 | Viable, inventory traversal complete for endpoint; target enrichment partial |
| [American Dream Machines](https://www.admcars.com/inventory.htm) | Des Moines, IA | HTTP 200 initial HTML + documented JS HTML paging at offsets 25,50,75. 25+25+25+5=80 cards matches totalcars=80. Four target details 200. | 34, 20 known asks; remainder blank or call-for-price | 4 | Viable, inventory traversal complete; target enrichment partial |
| [Midwest Muscle Cars](https://www.midwestmusclecars.com/listings/sale/) | Lake Zurich, IL consignment | HTTP 200 single sale page, nine cards and no next page; all three target details fetched. Explicit detail-table vehicle location Lake Zurich. | 3 active | 3 | Best small local complete target source |
| [JWS Classics](https://www.jwsclassics.com/inventory/) | Greendale, WI | Inventory HTTP 200 with eight classic target links plus a 1959 Corvette and later ordinary Mustang excluded; advertised detail `/?id=4` fails HTTP 500 `Variable ID is undefined` on both HTTP and HTTPS. No usable price/detail enrichment. | No records imported | 0 | Incomplete/broken detail site; not zero inventory |
| [Duffy's Classic Cars](https://www.iowaclassiccars.com/cars-for-sale) | Cedar Rapids, IA | Public robots allows general crawling. Inventory request HTTP 403. Stop. Search-engine inventory indication alone was not imported. | No records imported | 0 | Access blocked; not zero inventory |
| [North Shore Classics](https://www.nsclassics.com/usedinventorytypeused/) | Mundelein, IL | HTML inventory is empty shell. Observed site JS documents permitted HTML endpoint. Fetched offsets 0,24,48,72,96,120: 24×5+1=121 cards, matching returned count. No details fetched in this bounded subtask. | 12 active card observations | 0 | Viable additional adapter; inventory traversal complete; all detail enrichment pending |
| [500 Classic Auto Sales](https://www.500classicauto.com/cars-for-sale) | Knightstown, IN | First inventory page 200, 24 of 77 records, including explicit sold. Next control is JS POST `/inventory/search` with `RecaptchaResponse`; not attempted. Representative Mustang detail returned HTTP 403; stopped. | 3 card observations, two active and one sold | 0 | Partial first-page source; detail access blocked, not zero inventory |
| [J & S Motors](https://jsmotors.com/collections/all) | Fairmount, IN | Public Shopify collection HTML pages 1–2 fetched, 24+21=45 cards; terminal page 2 verified. Representative 1982 Corvette detail 200 with matching Product JSON-LD Offer InStock $38,500. | 24 classic-year observations; 22 active, two sold by status class | 1 | Viable additional adapter; inventory traversal complete, detail enrichment partial |
| [indyauto.com](https://www.indyauto.com) | Unverified candidate domain | Home response is 114-byte domain/landing response, not suitable classic inventory. No seller inventory inferred. | None | 0 | Unsuitable candidate, not an inventory result |

Best initial practical adapters: **Volo, GR Auto Gallery, American Dream Machines and Midwest Muscle Cars**. North Shore Classics and J & S Motors are also usable and should be added/left honestly pending if implementation capacity prevents them in this pass. 500 Classic can preserve allowed first-page observations with an explicit partial status; do not attempt challenge-protected pagination.

A search-engine discovery pass also found additional relevant dealers, but their snippets are not live collection evidence. Avoid unverified low-price domains that look like cloned dealer templates; none were imported.

## Exact parser contracts and traps

### Volo

- [Policy](https://www.volocars.com/robots.txt): general public pages permitted; **10-second crawl delay**. `/api/v1/vehicles`, `/api/inventory`, search/full-text, result routes and most query filters prohibited. Use normal linked inventory pages and detail URLs; no API workaround.
- Card `.volo-sales-list-grid-item`; exact identity is nested `a[href*="/vehicles/"]` `/auto-sales/vehicles/<numeric-id>/<slug>`. Join Car JSON-LD on numeric ID extracted from its URL if enriching from inventory metadata; **JSON-LD and card ordering differ**.
- Title `.volo-thumb-name h2` plus `h1`; price **`.only-price` only**, not `.monthly-price`, appraised value or deposit. Engine/transmission/stock `.volo-engine-trans-thumb span` label and nested `i`. Photos are card-scoped `.keen-slider[data-images-src]` or actual nested image.
- Card banner `.volo-vehicle-thumb-banner`: sold, incoming and pending are availability evidence. Incoming records kept unknown; advertised rental rates are not asks and rental cards are excluded.
- **Every detail page contains a hidden generic sale-pending waitlist modal. Never mark a listing pending from whole-page text.** Only page/card-specific availability counts.
- Pagination `.pagination a[rel=next]`; deduplicate page URLs, stop disabled next, strip only fragments. Broad `/vehicles` contains museum cars/rentals so status/type filtering is essential.

### GR Auto Gallery

- [Policy](https://www.grautogallery.com/robots.txt): same DealerAccelerate restrictions as Volo, **10-second crawl delay**. Avoid API and branch/query shortcuts disallowed by policy. Read broad allowed HTML and apply local scope.
- Cards `a[itemtype="https://schema.org/Car"]`; stable ID is first path segment after `/vehicles/` (e.g. `bin1260-j`). `.ag-list-item-title`, `.price`; `[itemprop=productionDate]`, `[itemprop=model]`, `[itemprop=vehicleEngine]`, `[itemprop=vehicleTransmission]`, `[itemprop=mileageFromOdometer]`. Location is label/value list item inside the same card.
- Many cards name exact showroom address in description; preserve actual vehicle-specific branch and watch off-site statements. Metro Detroit is Commerce Township, Grand Rapids showroom is Kentwood, Indianapolis showroom is Plainfield. Branch centers are location approximations pending explicit geocoding.
- `.pagination` links pages 1–5; 18 duplicate source URLs were present across fetched pages; never count them twice or overwrite enriched data with a sparse duplicate.
- Representative detail `/vehicles/bw4525/1966-chevrolet-corvette` includes odometer 655, but narrative says miles since restoration. Keep odometer reading separate from total-mileage certainty.
- Actual later default-expansion candidate observed: [1998 Ford Mustang SVT Cobra Convertible](https://www.grautogallery.com/vehicles/bin1260-j/1998-ford-mustang-svt-cobra-convertible). Seller claim only. Shelby/Boss/Roush candidates are separately configurable additions, not automatically SVT/Cobra.

### American Dream Machines

- [Policy](https://www.admcars.com/robots.txt): **5-second crawl delay**; `/includes/`, `/cgi-bin/`, `/tmp/`, staging images, window stickers and `cid=` query routes disallowed. Current listing URLs and actual public `isapi_xml.php` inventory HTML paging allowed.
- `/inventory.htm` embeds `totalcars=80; increment=25; loadnext=25; inventoryConstant['sold']='Available'; orderby='&orderby=price,desc'`.
- [Observed paging script](https://www.admcars.com/scripts/inventory.js) requests `/isapi_xml.php?module=inventory&offset=25&sold=Available&orderby=price,desc`; increment by 25 until total. Response line one is total, line two filter JSON, remaining text card HTML. No browser needed.
- Card `.search-results-item`; parse literal URL from `onclick="document.location.href='...'"` **without execution**, numeric `-c-<id>.htm` identity. Drop benign view-state query when canonicalizing detail identity.
- `.car_name_inventory_class`, `.search-results-price`; `.search-results-price-call` is price-on-request. Blank price remains unknown. Images `.search-results-img img` scoped to that card; `images/ina_f.jpg` is generic and should become an empty photo/neutral placeholder.
- Actual detail fields are **`#details .datatable dl` with `dt`/`dd`**, not tables. Tables elsewhere belong to similar cars and are unsafe for main identity. `.inventory-detailed-internet-price` is the ask, `#stock_options` seller narrative. Keep any public VIN private/redacted in snapshot.

### Midwest Muscle Cars

- [Policy](https://www.midwestmusclecars.com/robots.txt): public listings allowed, WooCommerce private files/admin/add-to-cart blocked. Five-second throttling used conservatively.
- Sale inventory `.listing[id]` ID `listing-<post-id>`; `.listing-title`; `.listing-tag` status; `.listing-image` or nested actual/noscript img for correct photo.
- Detail `table.listing-info` contains **multiple alternating th/td label/value pairs per row**, not only one pair. Preserve all pairs. Main `h1`, explicit Price and Location table fields.
- [1966 Mustang Fastback](https://www.midwestmusclecars.com/listings/1966-mustang-fastback/): post 3194, $59,900, advertised 347 engine, four-speed, red/black, explicit Lake Zurich.
- [1969 pro touring camaro](https://www.midwestmusclecars.com/listings/1969-pro-touring-camaro/): post 3110, $79,900, LS3, six-speed Tremec; seller table says `Year 69`, `Model camro`; title provides full 1969/Camaro. Keep source text, normalize from corroborating title.
- [1964 corvette roadster](https://www.midwestmusclecars.com/listings/1964-corvette-roadster/): post 3037, $45,000; advertised 327/365, four-speed, convertible. `327` is displacement and `365` is claimed power, not verified measured horsepower.

### North Shore Classics

- [Policy](https://www.nsclassics.com/robots.txt): **5-second delay**; `/includes`, `/wp-admin`, `.json`, various direct model/year/price query routes disallowed. Public HTML endpoint actually used by its site was fetched.
- [Observed paging script](https://www.nsclassics.com/wp-content/themes/aanWordpress/scripts/inventory.js) constructs `/isapi_xml.php?module=inventory&pageID=741&main=&limit=24&orderby=year,make,model&offset=0`. 24-item increments. First response line total=121, next two lines metadata, rest HTML. No prohibited JSON endpoint was used.
- `.inventory-card`; parse literal path in `onclick="getDetailed('/used-vehicle-...-c-<id>/')"` as data. `.single-car-name > p` first title; last `.single-car-name h4` is current discounted ask (first may be crossed-out old price); nested main img.
- Details not enriched in this research subtask; actual vehicle location can differ from dealer and must remain reviewable.

### J & S Motors

- [Policy](https://jsmotors.com/robots.txt): public `/collections` and `/products` HTML allowed; checkout/cart/private endpoints excluded; no checkout or transactional endpoint used.
- `/collections/all` → `/collections/all?page=2`, explicit terminal pagination verified. `.product-card`; nested `a[href^='/products/']` stable slug and Shopify numeric product ID embedded in image/container IDs. `.product-card__title`; price scoped to card.
- **All templates include hidden `Sold out` and `Sale` badge wording. Use `.price--sold-out` status class or detail Offer availability, never raw text.** A zero Shopify price becomes unknown/price-on-request review, not a free car.
- Card photos use `noscript img[src]` usable image URL or `data-src` template; do not expose unresolved `{width}` templates. Product JSON-LD supports actual detail image/offer.
- [1982 Corvette Collector Car](https://jsmotors.com/products/1982-corvette-collector-car): Product JSON-LD `InStock`, ask $38,500; approximately 4,000 actual miles is seller-claimed. Photo matched exact product.

## Limitations and next steps

All 170 drive estimates remain unavailable. Dealer city/branch is not proven actual vehicle location; routing and geocoding must preserve precision and off-site uncertainty. No four-hour matches may be asserted from this data alone. Iowa and MI branch records may be outside four hours even when their straight-line radius is plausible.

No safe auto-grouping was performed; no matching identifiers were assumed. This data should enter the canonical backend as separate source ads, with known same-source duplicates removed. Seller VINs present on ADM detail evidence should be stored privately and deliberately redacted from public snapshots. Asking prices were not conflated with monthly payments, deposits, appraisals or bids.

Inventory-level discovery coverage can be complete while detail enrichment is partial. This collection is complete only for the tested endpoint pages/time window and reported caps; source failure cannot justify removal. Preserve first-tracked time and observation histories when importing again. Source errors, unknown asks, incoming stock, explicit sold ads and later specialty claims all remain distinct categories.
