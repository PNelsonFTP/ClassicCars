# Source coverage

> **September 8, 2026 final review refresh:** 3,139 retained ads / 3,139 groups, 3,120 public ads, 16 coordinate records and zero actual road routes. The final pass fetched 93 fresh catalog pages and exhausted the accessible configured queues. Details and real duplicate reconciliation remain open; 500 Classic and Autotrader stayed paused. See [current scan evidence](docs/validation/inventory-full-scan.json), [scope validation](docs/CONFIGURED_SCOPE_VALIDATION.md) and [handoff](HANDOFF.md). The earlier observations and counts below remain historical evidence.


Report generated 2026-09-08T03:17:11.110Z. Evaluated 26 configured candidates across marketplaces, dealers, consignment, regional classifieds, forums, auctions and manual sources. Nine contributed real observations; seven passed live production inventory parsing checks during the initial session. The later recorded Autotrader refresh returned an unavailable template and 500 Classic returned 403, preserving their prior 19/3 ads. These are blocked refreshes, not zero inventory.

Initial research documents: [dealer evidence](docs/DEALER_RESEARCH.md), [marketplace/access evidence](docs/MARKETPLACE_RESEARCH.md), [vehicle/routing references](docs/REFERENCE_RESEARCH.md). Their dates, HTTP evidence, query URLs, pagination and policy links explain each decision. Configuring a source is not a promise of successful coverage.

| Source | Category | Observed ads | Latest status | Tested scope | Evidence and gap |
|---|---|---:|---|---|---|
| [ClassicCars.com](https://classiccars.com) | Marketplace | 1387 | partial | 1960–1989 · three models · 500-mile source discovery from 60187 | 25 catalog pages verified. 1,387 ad observations; 31 details checked. This is a discovery envelope, not a four-hour limit. Last run: Inventory page cap reached; queued pages remain.. |
| [Volo Museum Auto Sales](https://www.volocars.com) | Classic dealer | 50 | partial | Volo, IL · broad inventory | Two catalog pages verified; rentals excluded. Detail enrichment partial; hidden generic pending modal ignored. Last run: Inventory page cap reached; queued pages remain.. |
| [GR Auto Gallery](https://www.grautogallery.com) | Consignment dealer | 44 | partial | MI / IN branches | Five catalog pages verified; duplicate IDs deduplicated. Later specialty claims separated. Last run: Inventory page cap reached; queued pages remain.. |
| [American Dream Machines](https://www.admcars.com) | Classic dealer | 34 | partial | Des Moines, IA | Four public HTML inventory pages verified at 25-ad offsets. Main vehicle detail fields are isolated from similar cars. Last run: Inventory page cap reached; queued pages remain.. |
| [Midwest Muscle Cars](https://www.midwestmusclecars.com) | Local consignment | 3 | complete | Lake Zurich, IL | One sale page, three target details verified. Actual listing location stated; driving route still unavailable. Last run: Configured scope exhausted.. |
| [North Shore Classics](https://www.nsclassics.com) | Classic dealer | 12 | partial | Mundelein, IL | Six 24-ad offsets verified; 12 target catalog ads. One public HTML detail endpoint verified with exact ID and price/specifications; 11 details remain. Last run: Public detailed HTML endpoint observed live; the earlier empty shell did not establish detail enrichment. This run validates actual fields. Dealer address does not establish stock location.. |
| [J & S Motors](https://jsmotors.com) | Classic dealer | 24 | partial | Fairmount, IN | Two Shopify catalog pages verified. Sold status comes from card CSS or matching Product Offer, not hidden badge text. Last run: Inventory page cap reached; queued pages remain.. |
| [500 Classic Auto Sales](https://www.500classicauto.com) | Classic dealer | 3 | blocked | Knightstown, IN · first page only | 24 of 77 cards scanned. Detail 403; challenge-associated POST pagination intentionally not attempted. Last run: https://www.500classicauto.com/cars-for-sale: Source HTTP 403; stopped without bypass.. |
| [Autotrader](https://www.autotrader.com) | Marketplace | 19 | partial | Mustang 1960–1989 · 500-mile query | 19 matching catalog ads, one detail. Active-results IDs exclude sponsored off-filter ads. Further models and nationwide queries remain unverified. Last run: https://www.autotrader.com/cars-for-sale/ford/mustang/wheaton-il?zip=60187&startYear=1960&endYear=1989&searchRadius=500: Autotrader public Next state missing; do not use disallowed internal service endpoint. |
| [Hemmings](https://www.hemmings.com) | Marketplace | Not collected | blocked | Not integrated / not collected | AI crawling restricted; homepage HTTP 403. No feed license or working pagination supplied. |
| [Classics on Autotrader](https://classics.autotrader.com) | Marketplace | Not collected | blocked | Not integrated / not collected | Direct homepage HTTP 403; indexed snippets are not live inventory. |
| [Craigslist Chicago & region](https://chicago.craigslist.org) | Owner / dealer classifieds | Not collected | restricted | Not integrated / not collected | Terms prohibit content collection without permission. Surrounding regional boards not collected. |
| [eBay Motors](https://www.ebay.com) | Marketplace / auction | Not collected | credential-required | Not integrated / not collected | Official Browse API credentials and vehicle coverage validation required. |
| [Cars.com](https://www.cars.com) | Marketplace | Not collected | restricted | Not integrated / not collected | Required filtered search and detail paths restricted; no stock count inferred. |
| [CarGurus](https://www.cargurus.com) | Marketplace | Not collected | incomplete | Not integrated / not collected | Public model page accessible; classic filters, current detail route and pagination not validated. Storage restrictions need review. |
| [Bring a Trailer](https://bringatrailer.com) | Auction | Not collected | restricted | Not integrated / not collected | Terms prohibit scraping and aggregation. No bids collected. |
| [Cars & Bids](https://carsandbids.com) | Auction | Not collected | blocked | Not integrated / not collected | Homepage returned 403; no challenge bypass. |
| [Mecum](https://www.mecum.com) | Auction | Not collected | permission-required | Not integrated / not collected | Written permission required for automated data collection. |
| [Barrett-Jackson](https://www.barrett-jackson.com) | Auction | Not collected | restricted | Not integrated / not collected | Robots denies general crawlers. |
| [CorvetteForum](https://www.corvetteforum.com) | Enthusiast classifieds | Not collected | restricted | Not integrated / not collected | AI agents restricted; no authorized feed verified. |
| [Vintage Mustang Forums](https://www.vintage-mustang.com) | Enthusiast classifieds | Not collected | restricted | Not integrated / not collected | AI agents explicitly blocked; no collection. |
| [Team Camaro](https://www.camaros.net) | Enthusiast classifieds | Not collected | restricted | Not integrated / not collected | AI agents explicitly blocked; no collection. |
| [Facebook Marketplace](https://www.facebook.com/marketplace) | Manual entry | Not collected | manual-only | Not integrated / not collected | User-provided records or exports only; no authenticated scraping. |
| [JWS Classics](https://www.jwsclassics.com) | Classic dealer | Not collected | incomplete | Not integrated / not collected | Catalog accessible, advertised detail route fails HTTP 500. Not zero inventory. |
| [Duffy’s Classic Cars](https://www.iowaclassiccars.com) | Classic dealer | Not collected | blocked | Not integrated / not collected | Inventory HTTP 403; stopped. |
| [indyauto.com](https://www.indyauto.com) | Dealer candidate | Not collected | unsuitable | Not integrated / not collected | Observed domain landing page has no vehicle inventory. |

Current open access struggles and next steps are consolidated in [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md#blocked-restricted-and-incomplete-sources). Configuration status is baseline feasibility; the latest recorded run determines recent application health. These dated reports do not continuously monitor source availability.

## Run ledger

Initial research rows preserve actual network observation dates; production reruns include cached reads with original dates. The bounded smoke default is 1 inventory page/1 detail request; normal defaults 5/50 and CLI overrides are visible. A complete run means its configured scope was exhausted, not the market. Remaining enrichment is scoped to IDs encountered in that run; it is not a cumulative source-wide backlog. Catalog page queues currently restart each cycle, so repeated small caps do not guarantee progress through later pages. Source failures do not prove removal.

| Source | Started UTC | Scope | Status | Pages fetched | Details succeeded or initial detail responses | Cache hits | Remaining enrichment |
|---|---|---|---|---:|---:|---:|---:|
| nsclassics | 2026-09-08T03:13:57.819Z | regional | partial | 0 | 1 | 0 | 11 |
| midwest | 2026-09-08T03:02:32.876Z | regional | complete | 1 | 3 | 2 | 0 |
| nsclassics | 2026-09-08T03:00:38.531Z | regional | partial | 6 | 1 | 1 | 11 |
| nsclassics | 2026-09-08T02:59:58.845Z | regional | partial | 1 | 0 | 1 | 0 |
| autotrader | 2026-09-08T02:56:57.976Z | regional | partial | 1 | 0 | 0 | 0 |
| 500classic | 2026-09-08T02:56:57.789Z | regional | blocked | 0 | 0 | 0 | 0 |
| jsmotors | 2026-09-08T02:56:57.763Z | regional | partial | 1 | 1 | 2 | 14 |
| nsclassics | 2026-09-08T02:56:57.755Z | regional | partial | 1 | 0 | 1 | 0 |
| midwest | 2026-09-08T02:56:57.743Z | regional | partial | 1 | 1 | 2 | 2 |
| admcars | 2026-09-08T02:56:52.497Z | regional | partial | 1 | 1 | 0 | 9 |
| grauto | 2026-09-08T02:56:41.872Z | regional | partial | 1 | 1 | 0 | 10 |
| volo | 2026-09-08T02:56:41.709Z | regional | partial | 1 | 1 | 2 | 49 |
| classiccars | 2026-09-08T02:56:41.573Z | regional | partial | 1 | 1 | 2 | 59 |
| autotrader | 2026-09-08T02:55:53.079Z | regional | blocked | 0 | 0 | 0 | 0 |
| 500classic | 2026-09-08T02:55:47.915Z | regional | blocked | 0 | 0 | 0 | 0 |
| jsmotors | 2026-09-08T02:55:37.629Z | regional | partial | 1 | 1 | 0 | 14 |
| nsclassics | 2026-09-08T02:55:32.387Z | regional | partial | 1 | 0 | 0 | 0 |
| midwest | 2026-09-08T02:55:22.230Z | regional | partial | 1 | 1 | 0 | 2 |
| admcars | 2026-09-08T02:55:17.008Z | regional | blocked | 0 | 0 | 0 | 0 |
| grauto | 2026-09-08T02:55:06.126Z | regional | blocked | 0 | 0 | 0 | 0 |
| volo | 2026-09-08T02:54:45.562Z | regional | partial | 1 | 1 | 0 | 49 |
| classiccars | 2026-09-08T02:54:35.260Z | regional | partial | 1 | 1 | 0 | 59 |
| autotrader | 2026-09-08T02:37:34.012Z | regional | partial | 1 | 1 | 0 | 18 |
| nsclassics | 2026-09-08T02:34:37.617Z | regional | partial | 6 | 0 | 0 | 12 |
| jsmotors | 2026-09-08T02:32:29.212Z | regional | partial | 2 | 1 | 0 | 23 |
| 500classic | 2026-09-08T02:32:29.107Z | regional | partial | 1 | 0 | 0 | 3 |
| classiccars | 2026-09-08T02:31:31.627Z | regional | partial | 25 | 31 | 0 | 1356 |
| admcars | 2026-09-08T02:29:48.570Z | regional | partial | 4 | 4 | 0 | 30 |
| midwest | 2026-09-08T02:29:48.490Z | regional | complete | 1 | 3 | 0 | 0 |
| volo | 2026-09-08T02:29:13.233Z | regional | partial | 2 | 6 | 0 | 44 |
| grauto | 2026-09-08T02:29:12.034Z | regional | partial | 5 | 5 | 0 | 39 |

North Shore correction: the first detail shell had no substantive fields and should not have counted as enriched. Final validation uses its publicly documented, robots-permitted HTML detail endpoint, exact data-pin identity, own specifications and Our Price amount; one detail verified and 11 remain. This evidence supersedes the earlier shell-success label in the preserved historical run.

ClassicCars remote discovery uses its supported 500-mile option for the 300-mile desired discovery envelope. Its pages retain local model/year validation. Dealer inventories are broad, not location-limited. Nationwide queues remove ClassicCars discovery restrictions and change the Autotrader radius; broad dealers reuse their national inventory. National refresh coverage remains unverified and must not be inferred from these regional observations.

No supported auction/forum feed was available without policy restrictions or additional authorization. CarGurus target filters/details and JWS broken detail pages remain incomplete. The product supports manual records/imports without scraping Facebook. Routes require separate enrichment.
