# Source access and deterministic collection

Reviewed September 12, 2026. This supersedes the access labels in the September 8 research reports. The source registry and Sources page now distinguish the transport tested, actual result, evidence links and next action for every configured source. A successful robots request, sitemap or homepage is not an inventory scan.

## Changes shipped

- Corrected the collector's `Accept` header to include plain text and a fallback. JWS robots returned 406 with the former HTML/JSON-only header and 200 with the corrected header.
- Robots matching uses the actual **MuscleScout** product token. A GPTBot-specific rule does not automatically apply to this independent deterministic collector. General and MuscleScout-specific denials and crawl delays still apply; HTML error responses cannot masquerade as an empty robots policy. Source/provider terms remain a separate decision.
- Added JWS catalog parsing. Only matching vehicle cards under **Current Inventory** and **Recently Sold** are admitted. The parser preserves sold status, unknown asks, original observation times and exact source IDs; irrelevant footer links and foreign hosts are rejected. Its own legacy HTTP card/image URLs are upgraded to HTTPS. Broken HTTP 500 detail pages remain disabled.
- Added explicit `detailMode: catalog-only`. Pending detail evidence remains visible; disabling a lane does not manufacture detail success or repeatedly resume impossible work. A reviewed smoke test validates the configured catalog lane only. Other sources still require catalog and detail success for recovery.
- Added repeatable source diagnostics and source-specific private feed templates. No new package dependencies, accounts, subscriptions or credentials were added.

## Reproduce the diagnostics

```sh
npm run sources:audit
npm run sources:audit -- --source=jws --catalog
npm run sources:browser-check -- https://classics.autotrader.com/ https://www.iowaclassiccars.com/cars-for-sale
npm run collect -- --source=jws --fresh --pages=5 --details=0
```

The audit checks all configured robots endpoints, writes private response evidence/hashes under `data/research/`, uses the collection lease and shared daily/interval budgets, and does not modify inventory or enable paused sources. `--catalog` parses one fresh configured page only for enabled, operationally allowed sources; counts never claim terminal coverage. Run it separately from collection.

The browser diagnostic uses installed Playwright Chromium in a new isolated context, identifies MuscleScout, validates public HTTPS destinations, blocks foreign origins, non-GET requests, service workers and robots-disallowed requests. It performs no login, uses no personal browser profile and solves no challenge. Because third-party resources and POSTs are excluded, it is a conservative transport diagnostic, not proof that every interactive feature works in a consumer browser. Review provider access conditions before invoking it; it is not an automatic fallback in production. Its HTML stays private. Chromium remains a development/diagnostic dependency, not a requirement for normal collection or GitHub Pages.

## Results and remaining paths

| Source | Current result / alternative actually checked | Collection path still needed |
|---|---|---|
| ClassicCars; Volo; GR Auto; American Dream Machines; Midwest Muscle; North Shore; J & S | Existing deterministic adapters remain in use. All seven robots endpoints rechecked successfully. Their earlier September 12 inventory refresh is separate from this access audit. | Continue bounded catalog/detail runs; ClassicCars still has a large detail queue, and two J & S detail URLs returned 404 in the earlier refresh. |
| JWS Classics | Corrected content negotiation makes robots accessible. Catalog 200; exact linked detail `detail/?id=4` still 500. New catalog-only adapter separates current and sold sections. | Repaired detail pages or dealer export for prices/specifications. Catalog observation is not detail verification. |
| Duffy’s | Robots and sitemap 200; ordinary inventory and exact sitemap-linked Mustang page 403; Chromium inventory 403. Sitemap contains navigation, not listing records. | Dealer/Carsforsale export or provider-approved working inventory route. |
| 500 Classic | Robots and sitemap 200; exact linked Mustang/Corvette pages 403; Chromium inventory 403. | Dealer export or repaired public access; retain old observations. |
| Autotrader | Identified Chromium returns 200 with page-unavailable template. | Approved Cox feed or dealer export. The prior 19 ads remain excluded from public export. |
| Classics on Autotrader | General robots allows ordinary pages; both HTTP and Chromium homepage requests return 403. | Cox/provider-authorized feed or restored ordinary access. |
| Hemmings | Robots 200; public policy URL returns a 403 challenge. Robots advertises a feed for the named OAI-SearchBot client. | A Hemmings agreement/feed for this application; the named partner route is not an authorization grant to MuscleScout. |
| eBay | Official bounded Browse adapter already exists; API requirements rechecked. No live token or verified whole-vehicle categories supplied. | Approved production application token, agreement reference and current Taxonomy leaf-category review; then a bounded live whole-car test. |
| Cars.com | Direct robots request 403; published robots excludes filtered search and vehicle detail routes. | Approved feed or seller's own permitted catalog/export. |
| CarGurus | Public model HTML 200. Attempted classic-year path returned an all-year model page, so not evidence of classic coverage. Terms restrict storage/public redistribution. | Provider-approved feed or seller export; verify classic filters before counting coverage. |
| Bring a Trailer | Current terms prohibit extraction/aggregation with ordinary or AI tools. | BaT agreement or independently supplied seller-owned records; preserve auction phase and end times. |
| Cars & Bids | Homepage now 200, so the old “blocked” finding was outdated. Current terms separately restrict unauthorized collection/storage. | Provider agreement or seller-owned export. |
| Mecum | Current robots explicitly requires prior written permission for automated extraction. | Authorized lot export/feed, including event dates, timezone and fees. |
| Barrett-Jackson | General robots denies all paths; Google-specific exceptions are not applicable. | Authorized lot export/feed and display permission. |
| CorvetteForum | Named GPTBot rule was over-applied. Linked operator terms separately restrict aggregation, including RSS. | Internet Brands agreement or independently supplied seller-owned records. |
| Vintage Mustang Forums; Team Camaro | Terms pages 200 and explicitly restrict ordinary collection as well as AI tools without a separate agreement. | VerticalScope agreement or independently supplied seller-owned records. |
| Facebook Marketplace | Kept original manual-only configuration; no authenticated browsing attempted. | Seller-owned records/export with provenance; ordinary account access is not bulk inventory authorization. |
| indyauto.com | Still a 114-byte landing response, not inventory. | Correct dealer identity and official catalog, or dealer export. No unrelated business was silently substituted. |

No provider agreement, paid feed, API credential or permission request was obtained/submitted during this work. Changing libraries or user-agent text does not create those missing inputs. Seller-direct records preserve their actual origin; they must not be labeled as a completed scan of a marketplace. Cross-listed cars remain separate ads until existing duplicate evidence supports grouping.

## Connect a feed for any configured source

```sh
npm run sources:feed-template -- ebay data/feeds/ebay.json
npm run sources:feed-template -- duffys data/feeds/duffys.json
npm run import:feed -- data/feeds/duffys.json
npm run import:feed -- data/feeds/duffys.json --apply
npm run export:snapshot
```

The template command works for every configured source and never overwrites a file. Templates deliberately fail validation until a real permission reference and review timestamp are supplied. Fill the actual export query, generation/observation times, rows, pagination and exact listing/image host allowlists. Publication and photo redistribution default to false. An empty template does not assert zero stock or completed pagination. Keep credentials and agreements out of GitHub. See [feed contracts and eBay requirements](AUTHORIZED_FEEDS.md).

## Primary evidence

- [Hemmings robots](https://www.hemmings.com/robots.txt), [Classics on Autotrader robots](https://classics.autotrader.com/robots.txt), [Cars.com robots](https://www.cars.com/robots.txt).
- [Craigslist terms](https://www.craigslist.org/about/terms), [CarGurus terms](https://www.cargurus.com/about/terms-of-use), [Bring a Trailer terms](https://bringatrailer.com/terms-of-use/), [Cars & Bids terms](https://carsandbids.com/terms-of-use/).
- [Mecum robots](https://www.mecum.com/robots.txt), [Barrett-Jackson robots](https://www.barrett-jackson.com/robots.txt), [Internet Brands terms linked by CorvetteForum](https://www.internetbrands.com/ibterms), [Vintage Mustang terms](https://www.vintage-mustang.com/help/terms/), [Team Camaro terms](https://www.camaros.net/help/terms/).
- [eBay Buy API requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html), [JWS inventory](https://www.jwsclassics.com/inventory/), [Duffy’s sitemap](https://www.iowaclassiccars.com/sitemap.xml), [500 Classic sitemap](https://www.500classicauto.com/sitemap.xml).
