# MuscleScout handoff — 1.1.0

## October 30 inventory refresh

Published data commit [`cc73156`](https://github.com/PNelsonFTP/ClassicCars/commit/cc7315652bc1bdb92fa330dd5980ffcf0f7fd0fd) passed the [Pages deployment](https://github.com/PNelsonFTP/ClassicCars/actions/runs/41117389993) and [all six CI jobs](docs/validation/github-ci-2026-10-30.json). [Live verification](docs/validation/github-pages-2026-10-30.json) matched all 107 public JSON files and the catalog consumed by the browser. Search, listing details, real images, city/ZIP lookup, travel filters and 1440/390/375px layouts passed without runtime errors, missing site assets or horizontal overflow.

The October 30 refresh retains **4,861 ads / 4,831 groups**, including **4,842 public ads / 4,818 public groups**. It added **124 ads**, recorded **125 numeric asking-price changes** (91 decreases, 34 increases), and refreshed details for **301 distinct ads**. **2 previously tracked ads** are newly seller-reported sold.

The configured scan refreshed 95 catalog pages and observed 3,152 distinct ads. Updated road tables provide 1,527 estimated ads from 149 city routes; default approximate four-hour shopping returns 498 ads / 490 groups, including 170 near-limit ads. Restricted sources, missing detail pages and remaining enrichment are recorded in the [dated refresh report](docs/validation/refresh-2026-10-30-comparison.md). No sale is inferred from an absent page.

## October 26 inventory refresh

Published data commit [`aa44d56`](https://github.com/PNelsonFTP/ClassicCars/commit/aa44d565f7d0a6c44f7dd6e50bebcdb1e5bc937a) passed the [Pages deployment](https://github.com/PNelsonFTP/ClassicCars/actions/runs/40343140819) and [all six CI jobs](docs/validation/github-ci-2026-10-26.json). [Live verification](docs/validation/github-pages-2026-10-26.json) matched all 106 public JSON files and the catalog consumed by the browser, with search, details, real images, city/ZIP lookup, travel filters and 1440/390/375px layouts passing without runtime errors, missing site assets or horizontal overflow.

The October 26 refresh retains **4,737 ads / 4,711 groups**, including **4,718 public ads / 4,698 public groups**. It added **159 ads**, recorded **186 numeric asking-price changes** (106 decreases, 80 increases), and refreshed details for **290 distinct ads**. **1 previously tracked ad** is newly seller-reported sold.

The configured scan refreshed 95 catalog pages and observed 3,137 distinct ads. Updated road tables provide 1,493 estimated ads from 148 city routes; default approximate four-hour shopping returns 498 ads / 493 groups, including 163 near-limit ads. Restricted sources, missing detail pages and the remaining ClassicCars detail backlog are documented in the [dated refresh report](docs/validation/refresh-2026-10-26-comparison.md). No sale is inferred from an absent page.

## October 22 approved GitHub delivery

Application/data commit [`5533b17`](https://github.com/PNelsonFTP/ClassicCars/commit/5533b178f41fba4745fb87207da2771191537d2e) is pushed to `origin/main` and [published on GitHub Pages](https://pnelsonftp.github.io/ClassicCars/). The [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/39799973841) and [all six CI jobs](docs/validation/github-ci-2026-10-22.json) passed. [Live verification](docs/validation/github-pages-2026-10-22.json) confirmed all 104 public JSON hashes, the catalog consumed by the browser, approximate and strict travel filters, ZIP/city lookup, explicit unsupported-origin handling, persistent travel preferences, search/details/images, 26 source-method panels and 1440/390/375px layouts without runtime errors or missing site assets.

The published defaults show 488 ads / 483 groups within the approximate four-hour search, including 157 near-limit ads. Inventory sightings remain October 19; publication does not renew source observations. Private environment/database files, required backups and road caches remain ignored. Closing delivery documentation does not change the deployed application or data. See [delivery status](docs/DELIVERY.md) for workflow links and retained evidence.

## October 21 location and results implementation

The approved [review](docs/LOCATION_AND_RESULTS_REVIEW_2026-10-21.md) is implemented in the [travel/results guide](docs/TRAVEL_AND_RESULTS_IMPLEMENTATION.md). Approximate city road travel now drives everyday/regional discovery, with planning buffers, near-limit matches, location basis, origin binding, city/ZIP controls and a versioned static atlas. GitHub Pages needs no routing key or running backend. Unsupported origins/destinations remain explicit; off-site and ambiguous cars do not inherit a dealer trip.

Collector improvements include consecutive failure tracking, audited targeted transient retry, changed-catalog detail work and relevance/fairness priorities. Stock normalization is shared with duplicate review; travel/search changes quietly establish alert baselines. Publication verifies origin/context, catalog parity and public privacy. `sbom:refresh` repairs the full manifest chain; retention remains report-only and preserves required recovery states and Low-confidence files.

Inventory sightings remain October 19. New geographic generation/export timestamps do not mean a seller was rechecked. The graph build uses separately installed native OSRM/osmium; ignored road cache is reproducible publication input, not a site runtime requirement. No source permission was bypassed and no external messages, commit or deployment were made in this implementation turn. See the [verification record](docs/validation/travel-2026-10-21.json): 1,484 estimated ads from 147 city routes; 488 nearby ads / 483 groups, including 157 near-limit ads. All 305 unit tests, 20 browser tests, both static exports, release smoke and the seven-report SBOM chain pass. All 214 protected non-public files and 17 backup pairs remain unchanged.

## October 20 approved cleanup completed

See the [cleanup receipt](docs/CLEANUP_RESULTS_2026-10-20.md). All 46 approved High/Medium entries were cleaned, all 182 Low files are unchanged, and 17 database/environment backup pairs remain. Required production output was rebuilt and retained. Fresh verification passed 276 unit tests, 18 desktop/mobile browser tests, both static exports, strict types, release smoke, SQLite integrity and SBOM/release checks. The reduction within candidate paths after rebuilding is approximately 2.35 GiB. Inventory, credentials and public JSON are unchanged; nothing was committed or published.

## October 20 project review

The [full project review](docs/PROJECT_REVIEW_2026-10-20.md) inventories hidden and ignored files, maps commands/dependencies, and lists cleanup candidates with exact sizes and approval conditions. No files were deleted, no inventory refreshed, and no commit, push or deployment was made. The latest inventory remains October 19. No listeners were visible on 3100/4410; the review did not establish all-process or external-consumer absence. Read the report before cleaning backup pairs, build output or evidence.

## October 19 inventory refresh

Published data commit [`7e6cde5`](https://github.com/PNelsonFTP/ClassicCars/commit/7e6cde55af10db37c8dbecf2df7f78f1549baaa0) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/39257896206), including 276 tests across 27 files. [Live verification](docs/validation/github-pages-2026-10-19.json) passed exact catalog/snapshot/detail hashes, including the catalog loaded by the browser, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. No collection runs or leases remain active.

The October 19 refresh retains **4,578 ads / 4,552 groups**, including **4,559 public ads / 4,539 public groups**. It added **25 ads**, recorded **14 numeric asking-price changes** (11 decreases, 3 increases), and refreshed details for **281 distinct ads**. No previously tracked ads changed to seller-reported sold.

Existing GR Auto and J & S detail-page 404s remain documented with their original dates; prior observations are retained.

The [dated refresh report](docs/validation/refresh-2026-10-19-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## October 17 inventory refresh

Published data commit [`3e10d80`](https://github.com/PNelsonFTP/ClassicCars/commit/3e10d8050d52767c77de686954d13d3fdd47dc2e) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/39032716881), including 276 tests across 27 files. [Live verification](docs/validation/github-pages-2026-10-17.json) passed exact catalog/snapshot/detail hashes, including the catalog loaded by the browser, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. No collection runs or leases remain active.

The October 17 refresh retains **4,553 ads / 4,529 groups**, including **4,534 public ads / 4,516 public groups**. It added **135 ads**, recorded **87 numeric asking-price changes** (81 decreases, 6 increases), and refreshed details for **280 distinct ads**. 2 previously tracked ads changed to seller-reported sold.

One additional J & S detail page returned HTTP 404 today. Its prior observation is retained; earlier GR Auto and J & S 404s remain documented with their original dates.

The [dated refresh report](docs/validation/refresh-2026-10-17-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## October 13 inventory refresh

Published data commit [`4893693`](https://github.com/PNelsonFTP/ClassicCars/commit/4893693ce774a67a07aec9ed3892cad190d01b55) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/38403130497), including 276 tests across 27 files. [Live verification](docs/validation/github-pages-2026-10-13.json) passed exact catalog/snapshot/detail hashes, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. No collection runs or leases remain active.

The October 13 refresh retains **4,418 ads / 4,394 groups**, including **4,399 public ads / 4,381 public groups**. It added **91 ads**, recorded **66 numeric asking-price changes** (53 decreases, 13 increases), and refreshed details for **278 distinct ads**. One previously tracked ad changed to seller-reported sold.

One GR Auto detail URL returned HTTP 404; its prior observation is retained and the task is blocked.

The [dated refresh report](docs/validation/refresh-2026-10-13-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## October 9 inventory refresh

Published data commit [`d94c29d`](https://github.com/PNelsonFTP/ClassicCars/commit/d94c29d98e0bf6e728ece8fd37ff8ddd6b75460c) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/37944497957), including 276 tests across 27 files. [Live verification](docs/validation/github-pages-2026-10-09.json) passed exact catalog/snapshot/detail hashes, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. No collection runs or leases remain active.

The October 9 refresh retains **4,327 ads / 4,304 groups**, including **4,308 public ads / 4,291 public groups**. It added **150 ads**, recorded **81 numeric asking-price changes** (77 decreases, 4 increases), and refreshed details for **273 distinct ads**. One previously tracked ad changed to seller-reported sold.

The [dated refresh report](docs/validation/refresh-2026-10-09-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## October 5 inventory refresh

Published data commit [`7c1ea0f`](https://github.com/PNelsonFTP/ClassicCars/commit/7c1ea0f394de23fef157a35b7ec4adfcc38fb093) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/37309718857), including 276 tests across 27 files. [Live verification](docs/validation/github-pages-2026-10-05.json) passed exact catalog/snapshot/detail hashes, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. The verification waited for inventory to render before interacting after two initial loading timeouts. No collection runs or leases remain active.

The October 5 refresh retains **4,177 ads / 4,154 groups**, including **4,158 public ads / 4,141 public groups**. It added **9 ads**, recorded **7 numeric asking-price changes** (6 decreases, 1 increase), and refreshed details for **50 distinct ads**. No previously tracked ads changed to seller-reported sold.

The [dated refresh report](docs/validation/refresh-2026-10-05-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## October 4 inventory refresh

Published data commit [`efad035`](https://github.com/PNelsonFTP/ClassicCars/commit/efad035303825ab57d1f1dc24407a93a449bc6b8) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/37205622804), including 276 tests across 27 files. [Live verification](docs/validation/github-pages-2026-10-04.json) passed exact catalog/snapshot/detail hashes, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. No collection runs or leases remain active.

The October 4 refresh retains **4,168 ads / 4,145 groups**, including **4,149 public ads / 4,132 public groups**. It added **112 ads**, recorded **73 numeric asking-price changes** (68 decreases, 5 increases), and refreshed details for **265 distinct ads**. One previously tracked ad is newly seller-reported sold.

The [dated refresh report](docs/validation/refresh-2026-10-04-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## October 1 inventory refresh

Published data/code commit [`ac8bb69`](https://github.com/PNelsonFTP/ClassicCars/commit/ac8bb6949c728bcc5cd8aa73c9b56bd0e148c70b) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/36855941334) with 276 tests in 27 files and [all six CI jobs](docs/validation/github-ci-2026-10-01.json). [Live verification](docs/validation/github-pages-2026-10-01.json) passed exact catalog/snapshot/detail hashes, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. No collection runs or leases remain active.

The October 1 refresh retains **4,056 ads / 4,033 groups**, including **4,037 public ads / 4,020 public groups**. It added **55 ads**, recorded **42 numeric asking-price changes** (40 decreases, 2 increases), and refreshed details for **263 distinct ads**. 8 previously tracked ads are newly seller-reported sold.

The [dated refresh report](docs/validation/refresh-2026-10-01-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## September 29 inventory refresh

Published data commit [`80014f3`](https://github.com/PNelsonFTP/ClassicCars/commit/80014f325d8f3edc6abac81cdb07db40372e3246) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/36646771561), including 269 tests across 27 files. [Live verification](docs/validation/github-pages-2026-09-29.json) passed exact catalog/snapshot/detail hashes, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. No collection runs or leases remain active.

The September 29 refresh retains **4,001 ads / 3,978 groups**, including **3,982 public ads / 3,965 public groups**. It added **64 ads**, recorded **21 numeric asking-price changes** (18 decreases, 3 increases), and refreshed details for **260 distinct ads**. No previously tracked ads were newly seller-reported sold.

The [dated refresh report](docs/validation/refresh-2026-09-29-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## September 27 inventory refresh

All six jobs in the [CI run](https://github.com/PNelsonFTP/ClassicCars/actions/runs/36349302914) passed for the deployed commit: Node 24 on Linux/macOS/Windows, Node 22.18 on Linux, hosted browser checks and Docker. [CI receipt](docs/validation/github-ci-2026-09-27.json).

Published application/data commit [`b014782`](https://github.com/PNelsonFTP/ClassicCars/commit/b014782e82f1986fa473c1cfde171451b70a3171) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/36349304979), including 269 tests across 27 files. [Live verification](docs/validation/github-pages-2026-09-27.json) passed exact catalog/snapshot/detail hashes, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. Collection finished with no running ingest runs or leases.

This refresh also fixes North Shore’s populated “Call for price” detail pages being rejected as empty. The source passed live validation and all 14 retained ads have fresh details; regression tests preserve unknown prices and reject empty/wrong-ad pages.

The September 27 refresh retains **3,937 ads / 3,914 groups**, including **3,918 public ads / 3,901 public groups**. It added **112 ads**, recorded **61 numeric asking-price changes** (50 decreases, 11 increases), and refreshed details for **246 distinct ads**. 2 previously tracked ads are newly seller-reported sold.

The [dated refresh report](docs/validation/refresh-2026-09-27-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## September 24 inventory refresh

Published data commit [`fc2de2f`](https://github.com/PNelsonFTP/ClassicCars/commit/fc2de2f05fe8496249778f2b418ebd4db17005cd) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/36003058178), including 268 tests across 27 files. [Live verification](docs/validation/github-pages-2026-09-24.json) passed exact catalog/snapshot/detail hashes, search, real images, all 26 source-method panels and 1440/390/375px layouts. No runtime errors, missing local assets, active collection runs or leases remain.

The September 24 refresh retains **3,825 ads / 3,802 groups**, with **3,806 public ads / 3,789 public groups**. It added **541 ads**, recorded **229 numeric asking-price changes** (220 decreases, 9 increases), and refreshed details for **238 distinct ads**. 7 previously tracked ads are newly seller-reported sold.

See the [dated refresh report](docs/validation/refresh-2026-09-24-comparison.md) for catalog coverage, verification and remaining detail/source limitations. Older dated sections below are historical evidence.

Final [CI run](https://github.com/PNelsonFTP/ClassicCars/actions/runs/34721449243) passed all six jobs on application/data commit `a639985`: Node 24 on Ubuntu, macOS and Windows; Node 22.18 on Ubuntu; hosted browser checks; and Docker.

Final source-access site deployment: [`a639985`](https://github.com/PNelsonFTP/ClassicCars/commit/a6399850962290fbd3224d0bf2010e2a0d10a433), [successful Pages run](https://github.com/PNelsonFTP/ClassicCars/actions/runs/34721449077), and [live verification](docs/validation/source-access-pages-2026-09-12.json). Exact catalog/snapshot/detail hashes match the local public export; 1440/390/375-width checks and all 26 source methods passed. No collection runs or leases remain active.

## September 12 source-access improvement

The [access audit and operating guide](docs/SOURCE_ACCESS.md) replaces blanket “AI blocked” labels with dated methods, evidence and next steps for all 26 sources. Fixed robots user-agent matching and JWS content negotiation, added catalog-only collection, deterministic HTTP/Chromium diagnostics, and incomplete private feed templates for every configured source. The new JWS scan found 44 advertised vehicles and eight matching classics, **all explicitly sold**; it added no active stock or known asking prices. Current totals are **3,284 retained ads / 3,262 groups**, **3,265 public ads / 3,249 public groups**. This access audit does not redate the earlier inventory refresh.

403 responses remain for Duffy’s, 500 Classic and Classics on Autotrader in HTTP/Chromium tests. Autotrader still serves an unavailable template. Forum, auction and other provider restrictions, missing eBay access, unresolved cross-listings, the ClassicCars detail backlog and J & S 404s remain documented. No new dependencies or credentials were added. [Machine-readable access evidence](docs/validation/source-access-2026-09-12.json).

Operational documentation reviewed October 30, 2026; the latest inventory refresh is [October 30](docs/validation/refresh-2026-10-30-comparison.md). The September 10 publication adds live Pages and remote CI evidence; earlier 1.1.0 release checks retain their September 8 dates. Original local commits `4835c0a` (delivery) and `42a6622` (improvements) are preserved in the private prepublication Git bundle. Their public-history equivalents exclude research fixture data. The public [PNelsonFTP/ClassicCars repository](https://github.com/PNelsonFTP/ClassicCars) is configured as `origin`. [Delivery status](docs/DELIVERY.md) records the approved publication and actual remote results.

## Open and review

The [web preview on 3100](http://127.0.0.1:3100) and [private API on 4410](http://127.0.0.1:4410/health) were restarted September 10; the worker remains off. Separate `npm run dev:web` and `npm run api` processes reproduce that state. The full `npm run dev` command below also starts the worker. Use **Settings & connection** with the password in the private `.env`; an API restart expires earlier sessions. Credentials are not included in the website.

```sh
npm ci
npm run setup
npm run dev
```

Setup preserves the database, environment/password, settings and workspace. The launchers provide the same local option. A fresh clone has the public snapshot but an empty connected database until intentional collection/import/restore. Existing preview processes are transient; the commands above reproduce them. Do not stop unrelated software to free a port.

## What changed

- Collection persists catalog page queues by source/query/scope, independent detail queues, job IDs/cancel/retry/recovery, and partial scheduling. Legacy observations now populate the operational backlog without inventing fresh requests. Source failures retain typed access/policy/layout/network causes, shared daily budgets, Retry-After and review pauses.
- Duplicate review ranks corroborated evidence, displays conflicts and all source asks/links, supports dealer aliases, conservative stock normalization, manual selection, pagination, dismiss/undo and overlapping merge-history replay. Ads remain source records; group counts are not verified unique cars.
- Saved searches offer vehicle/ad alert policies and optional crosspost notifications. Delivery uses immutable digest identities, deadlines, opt-in checks and visible blocked/uncertain/dead-letter recovery. The initial baseline remains quiet. No real external notification was sent.
- Geocoding validates address evidence, rotates work fairly and sends ambiguous records to explicit review. Routing honors caller freshness, exact endpoints/options, shared quotas and location changes. No real ORS routes exist without the missing key.
- Source/user provenance, field-specific reason/date, reset and generation recomputation are exposed in the UI. Public exports remove private evidence and reevaluate feed permissions/expiry. Browser availability ages from original observations, including auction freshness and deadlines.
- Static mode loads a smaller dictionary catalog with lazy exact-ad details. Rendered cards are paginated. API reads use bounded batches and source/favorite prefilters; remaining all-match memory/rescans are documented. Image failures try only that ad's own photos.
- Backend URL editing now stays separate from the authenticated endpoint, and redirects are rejected. Debounced private-workspace writes are serialized through acknowledged revisions; a conflict retains edits on screen for explicit recovery rather than silently overwriting another tab.
- Authorized feed import, a permission-gated eBay request adapter, specialty documentary evidence and dated year-ceiling data are available. No provider agreement or live auction feed was fabricated. New operational/readiness/service/release/SBOM tools have runbooks.

## Inventory and outstanding data work

The latest retained inventory is the **October 30, 2026 refresh: 4,861 ads / 4,831 groups**, including **4,842 public ads / 4,818 public groups**. It added 124 ads, recorded 125 numeric asking-price changes and refreshed 301 distinct detail pages. The public export is dated `2026-10-30T19:39:35.505Z`; source observation dates remain separate from geographic generation. ClassicCars has 4,526 due detail tasks after bounded enrichment. Existing missing-page tasks and source-access restrictions remain open; see the [dated comparison](docs/validation/refresh-2026-10-30-comparison.md). Ads and groups are not verified unique physical vehicles. Updated road tables provide 1,527 estimated ads from 149 city routes; default approximate four-hour shopping returns 498 ads / 490 groups, including 170 near-limit ads.

The October 19 collection finished through the CLI. Both root and `/ClassicCars` exports and a private database/environment backup are retained. Process state must be checked at the time of use; historical refresh reports do not prove that a worker is currently running or stopped. Earlier dated results follow.

The September 10 run retained **3,197 ads / 3,175 groups**, with **3,178 public ads**, 58 additions and 1,045 distinct fresh detail observations. All six active dealer detail queues are fresh and complete. ClassicCars has 870 newly observed details; its remaining work is paused at the configured 1,000-request daily limit. 500 Classic and Autotrader remain paused, and restricted or disabled sources remain uncollected. The [refresh comparison](docs/validation/refresh-2026-09-10-comparison.md) reports price/status changes, original observation dates, quotas and due/retry counts. No sale is inferred from absence.

The September 8 catalog-only release refresh retained **3,139 ads / 3,139 current groups** from nine sources, with **3,120 ads publicly exportable**, 16 established coordinate records and zero actual routes. The scan fetched **93 fresh catalog pages**, completing at `2026-09-08T17:23:23.991Z`. Initial inventory was 1,576 ads, with 1,557 publicly exportable. A subsequent three-query national ClassicCars check fetched three pages and three details successfully and retained further page/detail work. The final configured catalog scan, refreshed counts, scope limits and blocked sources are recorded in [inventory scan evidence](docs/validation/inventory-full-scan.json) and [scope validation](docs/CONFIGURED_SCOPE_VALIDATION.md).

That September 8 scan covered the configured inventory catalogs of enabled, permitted adapters. It is not a claim that all US sellers or all detail pages have been inspected. Full detail enrichment remains a separate cumulative queue. Existing 500 Classic and Autotrader restrictions remain paused; disabled marketplaces/forums are not enabled by the scan. Prior observations survive unavailable sources and failed pages. The public snapshot continues to exclude Autotrader.

The approximate four-hour search uses supported city road tables, while strict mode accepts reported/reviewed destinations only. Use **Travel time unknown · review** for unsupported destinations and missing/ambiguous cities. Coordinates and straight-line miles never become drive times. Most specialty claims still require documentation or review. Cross-listed duplicate cars may remain separate even after the new matching tools were implemented.

## Website options and publication

**GitHub Pages remains fully supported and does not require Docker.** It serves the static frontend and dated public inventory; browser-local shortlists/notes/searches work without a backend. Private collection, SQLite, route jobs and scheduled alerts require a separately running local API/worker. HTTPS-to-local-network access is browser-dependent and needs validation at the intended deployed origin.

```sh
npm run export:snapshot
npm run build:exports
npm run verify:exports
```

The root build is `out/`; the `/ClassicCars` example is `out-subpath/`. Set `NEXT_PUBLIC_BASE_PATH` to the actual repository name before release. The manual Pages Actions workflow uploads static output only, with pinned actions. The user has approved delivery after local review; [delivery status](docs/DELIVERY.md) records the selected destination and actual publication result.

Docker is an optional local packaging route. The pinned Linux arm64 image built and passed isolated release checks. Its static output contains build-time data and requires a refresh/rebuild or connected mode. `docker compose up --build` is available, but no Compose deployment or OS autostart was installed. `npm run service -- generate` produced reviewable startup templates; install/uninstall are explicit operator actions.

## Checks and evidence

The September 10 inventory refresh passed **248 tests / 25 files**, strict TypeScript, both static builds, browser export checks and a 179-file public privacy/consistency scan. Publication added 11 SBOM regression tests; the final suite passes **259 tests / 26 files**, with all six remote CI jobs and live Pages verification passing. [The dated validation record](VALIDATION.md) links the receipts. The private post-refresh backup is retained; source data and personal state remain outside Git.

[VALIDATION.md](VALIDATION.md) records the September 8 results: 222 passing unit/API tests, 16 passing desktop/mobile browser tests, both static builds and final export privacy checks. The September 8 [static review receipt](docs/validation/static-review.json) matches the 3,120-ad snapshot. Clean macOS Node 24 and Linux Docker Node 24 passed the release smoke. The September 10 GitHub native matrix now also passes Node 24 on Ubuntu, Windows and macOS, plus Node 22.18.0 on Ubuntu, including setup, SQLite, restore, startup and SBOM checks. The Windows double-click launcher is still a separate manual acceptance check. Native Chromium 153 WebMCP registration/invocation/lifecycle passed without a polyfill. Local root/subpath isolation passed; public HTTPS-to-private-backend connectivity remains a separate check; the static Pages site is live and verified.

[SBOM.md](SBOM.md) links full/runtime CycloneDX, SPDX, all 471 lock locations/licenses, native/WASM hashes, target OS evidence and the September 8 zero-vulnerability advisory query. Four formerly unresolved optional-WASM package versions were directly inspected in the integrity-verified archive. This is package inventory evidence, not blanket source-content redistribution permission.

## Resume external acceptance when ready

```sh
npm run verify:routing
npm run verify:delivery -- --channel=webhook
npm run verify:delivery -- --channel=email
npm run coverage:report -- docs/CONFIGURED_SCOPE_VALIDATION
```

Readiness commands send nothing by default. Real routing requires `MUSCLESCOUT_ORS_KEY` and explicit `--live`; a synthetic notification requires a user-authorized destination, enabled channel and `--send-test`. See [service acceptance](docs/SERVICE_ACCEPTANCE.md) for route geometry/receipt review and uncertain-send recovery. Approved feed files stay private and import dry-run unless `--apply` is supplied. Live source permission and credentials remain external inputs; [delivery status](docs/DELIVERY.md) tracks remote platform acceptance.

Back up with `npm run backup` before changing persistence. Keep SQLite/environment backups private; separately preserve raw evidence and browser-only exports when needed. [Operations](docs/OPERATIONS.md) documents restore, [architecture](docs/ARCHITECTURE.md) maps code/APIs, and [future work](FUTURE_IMPROVEMENTS.md) retains all real-world struggles.
