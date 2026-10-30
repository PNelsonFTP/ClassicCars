# MuscleScout 1.1.0 delivery

## October 30 inventory refresh

The October 30 refresh retains **4,861 ads / 4,831 groups**, including **4,842 public ads / 4,818 public groups**. It added **124 ads**, recorded **125 numeric asking-price changes** (91 decreases, 34 increases), and refreshed details for **301 distinct ads**. **2 previously tracked ads** are newly seller-reported sold.

The [refresh comparison](validation/refresh-2026-10-30-comparison.md), [public export audit](validation/public-export-review-2026-10-30.json), [travel verification](validation/travel-refresh-2026-10-30.json) and [static browser checks](validation/static-review-2026-10-30.json) record the verified data and exports. Updated road tables provide 1,527 estimated ads from 149 city routes; default approximate four-hour shopping returns 498 ads / 490 groups, including 170 near-limit ads. Private database/environment recovery pairs, raw evidence and road caches remain excluded from Git. Publication results are appended after deployment verification.

## October 26 inventory refresh

The October 26 refresh retains **4,737 ads / 4,711 groups**, including **4,718 public ads / 4,698 public groups**. It added **159 ads**, recorded **186 numeric asking-price changes** (106 decreases, 80 increases), and refreshed details for **290 distinct ads**. **1 previously tracked ad** is newly seller-reported sold.

The [refresh comparison](validation/refresh-2026-10-26-comparison.md), [public export audit](validation/public-export-review-2026-10-26.json), [travel verification](validation/travel-refresh-2026-10-26.json) and [root/project browser checks](validation/static-review-2026-10-26.json) record the verified inventory and static outputs. The updated export includes 1,493 ads with road estimates and 498 default approximate four-hour ads. Application code, dependencies and collection settings are unchanged; private state and backups remain excluded. Published data commit [`aa44d56`](https://github.com/PNelsonFTP/ClassicCars/commit/aa44d565f7d0a6c44f7dd6e50bebcdb1e5bc937a) passed the [Pages deployment](https://github.com/PNelsonFTP/ClassicCars/actions/runs/40343140819) and [all six CI jobs](validation/github-ci-2026-10-26.json). [Live verification](validation/github-pages-2026-10-26.json) matched all 106 public JSON files and the catalog consumed by the browser, with search, details, real images, city/ZIP lookup, travel filters and 1440/390/375px layouts passing without runtime errors, missing site assets or horizontal overflow. The closing documentation commit does not change the deployed application or inventory.

## October 22 location and results release

The approved application/data commit [`5533b17`](https://github.com/PNelsonFTP/ClassicCars/commit/5533b178f41fba4745fb87207da2771191537d2e) is pushed to `main` and live at [MuscleScout](https://pnelsonftp.github.io/ClassicCars/). The [Pages deployment](https://github.com/PNelsonFTP/ClassicCars/actions/runs/39799973841) succeeded using `/ClassicCars`. [All six CI jobs](https://github.com/PNelsonFTP/ClassicCars/actions/runs/39799956316) passed; the [CI receipt](validation/github-ci-2026-10-22.json) records each target and job URL. The closing documentation update records these results without changing deployed application/data bytes.

[Live verification](validation/github-pages-2026-10-22.json) matched every one of the **104 public JSON files**, including all detail chunks and city/ZIP reference shards. Browser checks at 1440, 390 and 375 pixels confirmed the actual loaded catalog, real road estimates, listing details/images, travel filters, ZIP/city lookup, explicit unsupported-origin behavior, saved travel preferences, typo search and 26 source-method entries. No browser runtime errors, missing site assets or horizontal overflow were found. Private screenshots are retained in ignored `data/reports/publication/github-pages-2026-10-22/`.

The release supplies **1,484 estimated ads from 147 shared city routes**. Default approximate four-hour shopping returns **488 ads / 483 groups**, including **157 near-limit ads**. Excluding near-limit ads returns 331 ads / 330 groups; strict reported-vehicle routes return 204 ads. Wheaton is the published origin; other origins require their own generated road table. The static frontend requires no routing API key, running backend or Docker container.

The release passed **305 unit tests in 29 files**, **20 desktop/mobile browser tests**, both static export paths, isolated release smoke, public travel/privacy/parity checks and the seven-report SBOM chain. Inventory remains **4,559 public ads / 4,539 groups**, with seller observations dated October 19. The geographic export's `2026-10-22T01:43:35.904Z` generation time does not renew those observations. Private credentials, database state, required backups, Low-confidence evidence and the road cache remain excluded from Git.

## October 19 inventory refresh

Published data commit [`7e6cde5`](https://github.com/PNelsonFTP/ClassicCars/commit/7e6cde55af10db37c8dbecf2df7f78f1549baaa0) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/39257896206), including 276 tests across 27 files. [Live verification](validation/github-pages-2026-10-19.json) passed exact catalog/snapshot/detail hashes, including the catalog loaded by the browser, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. No collection runs or leases remain active.

The October 19 refresh retains **4,578 ads / 4,552 groups**, including **4,559 public ads / 4,539 public groups**. It added **25 ads**, recorded **14 numeric asking-price changes** (11 decreases, 3 increases), and refreshed details for **281 distinct ads**. No previously tracked ads changed to seller-reported sold.

Existing GR Auto and J & S detail-page 404s remain documented with their original dates; prior observations are retained.

The [dated refresh report](validation/refresh-2026-10-19-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## October 17 inventory refresh

Published data commit [`3e10d80`](https://github.com/PNelsonFTP/ClassicCars/commit/3e10d8050d52767c77de686954d13d3fdd47dc2e) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/39032716881), including 276 tests across 27 files. [Live verification](validation/github-pages-2026-10-17.json) passed exact catalog/snapshot/detail hashes, including the catalog loaded by the browser, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. No collection runs or leases remain active.

The October 17 refresh retains **4,553 ads / 4,529 groups**, including **4,534 public ads / 4,516 public groups**. It added **135 ads**, recorded **87 numeric asking-price changes** (81 decreases, 6 increases), and refreshed details for **280 distinct ads**. 2 previously tracked ads changed to seller-reported sold.

One additional J & S detail page returned HTTP 404 today. Its prior observation is retained; earlier GR Auto and J & S 404s remain documented with their original dates.

The [dated refresh report](validation/refresh-2026-10-17-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## October 13 inventory refresh

Published data commit [`4893693`](https://github.com/PNelsonFTP/ClassicCars/commit/4893693ce774a67a07aec9ed3892cad190d01b55) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/38403130497), including 276 tests across 27 files. [Live verification](validation/github-pages-2026-10-13.json) passed exact catalog/snapshot/detail hashes, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. No collection runs or leases remain active.

The October 13 refresh retains **4,418 ads / 4,394 groups**, including **4,399 public ads / 4,381 public groups**. It added **91 ads**, recorded **66 numeric asking-price changes** (53 decreases, 13 increases), and refreshed details for **278 distinct ads**. One previously tracked ad changed to seller-reported sold.

One GR Auto detail URL returned HTTP 404; its prior observation is retained and the task is blocked.

The [dated refresh report](validation/refresh-2026-10-13-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## October 9 inventory refresh

Published data commit [`d94c29d`](https://github.com/PNelsonFTP/ClassicCars/commit/d94c29d98e0bf6e728ece8fd37ff8ddd6b75460c) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/37944497957), including 276 tests across 27 files. [Live verification](validation/github-pages-2026-10-09.json) passed exact catalog/snapshot/detail hashes, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. No collection runs or leases remain active.

The October 9 refresh retains **4,327 ads / 4,304 groups**, including **4,308 public ads / 4,291 public groups**. It added **150 ads**, recorded **81 numeric asking-price changes** (77 decreases, 4 increases), and refreshed details for **273 distinct ads**. One previously tracked ad changed to seller-reported sold.

The [dated refresh report](validation/refresh-2026-10-09-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## October 5 inventory refresh

Published data commit [`7c1ea0f`](https://github.com/PNelsonFTP/ClassicCars/commit/7c1ea0f394de23fef157a35b7ec4adfcc38fb093) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/37309718857), including 276 tests across 27 files. [Live verification](validation/github-pages-2026-10-05.json) passed exact catalog/snapshot/detail hashes, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. The verification waited for inventory to render before interacting after two initial loading timeouts. No collection runs or leases remain active.

The October 5 refresh retains **4,177 ads / 4,154 groups**, including **4,158 public ads / 4,141 public groups**. It added **9 ads**, recorded **7 numeric asking-price changes** (6 decreases, 1 increase), and refreshed details for **50 distinct ads**. No previously tracked ads changed to seller-reported sold.

The [dated refresh report](validation/refresh-2026-10-05-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## October 4 inventory refresh

Published data commit [`efad035`](https://github.com/PNelsonFTP/ClassicCars/commit/efad035303825ab57d1f1dc24407a93a449bc6b8) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/37205622804), including 276 tests across 27 files. [Live verification](validation/github-pages-2026-10-04.json) passed exact catalog/snapshot/detail hashes, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. No collection runs or leases remain active.

The October 4 refresh retains **4,168 ads / 4,145 groups**, including **4,149 public ads / 4,132 public groups**. It added **112 ads**, recorded **73 numeric asking-price changes** (68 decreases, 5 increases), and refreshed details for **265 distinct ads**. One previously tracked ad is newly seller-reported sold.

The [dated refresh report](validation/refresh-2026-10-04-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## October 1 inventory refresh

Published data/code commit [`ac8bb69`](https://github.com/PNelsonFTP/ClassicCars/commit/ac8bb6949c728bcc5cd8aa73c9b56bd0e148c70b) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/36855941334) with 276 tests in 27 files and [all six CI jobs](validation/github-ci-2026-10-01.json). [Live verification](validation/github-pages-2026-10-01.json) passed exact catalog/snapshot/detail hashes, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. No collection runs or leases remain active.

The October 1 refresh retains **4,056 ads / 4,033 groups**, including **4,037 public ads / 4,020 public groups**. It added **55 ads**, recorded **42 numeric asking-price changes** (40 decreases, 2 increases), and refreshed details for **263 distinct ads**. 8 previously tracked ads are newly seller-reported sold.

The [dated refresh report](validation/refresh-2026-10-01-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## September 29 inventory refresh

Published data commit [`80014f3`](https://github.com/PNelsonFTP/ClassicCars/commit/80014f325d8f3edc6abac81cdb07db40372e3246) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/36646771561), including 269 tests across 27 files. [Live verification](validation/github-pages-2026-09-29.json) passed exact catalog/snapshot/detail hashes, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. No collection runs or leases remain active.

The September 29 refresh retains **4,001 ads / 3,978 groups**, including **3,982 public ads / 3,965 public groups**. It added **64 ads**, recorded **21 numeric asking-price changes** (18 decreases, 3 increases), and refreshed details for **260 distinct ads**. No previously tracked ads were newly seller-reported sold.

The [dated refresh report](validation/refresh-2026-09-29-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## September 27 inventory refresh

All six jobs in the [CI run](https://github.com/PNelsonFTP/ClassicCars/actions/runs/36349302914) passed for the deployed commit: Node 24 on Linux/macOS/Windows, Node 22.18 on Linux, hosted browser checks and Docker. [CI receipt](validation/github-ci-2026-09-27.json).

Published application/data commit [`b014782`](https://github.com/PNelsonFTP/ClassicCars/commit/b014782e82f1986fa473c1cfde171451b70a3171) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/36349304979), including 269 tests across 27 files. [Live verification](validation/github-pages-2026-09-27.json) passed exact catalog/snapshot/detail hashes, search, images, 26 source-method entries and 1440/390/375px layouts, with no runtime errors or missing local assets. Collection finished with no running ingest runs or leases.

The September 27 refresh retains **3,937 ads / 3,914 groups**, including **3,918 public ads / 3,901 public groups**. It added **112 ads**, recorded **61 numeric asking-price changes** (50 decreases, 11 increases), and refreshed details for **246 distinct ads**. 2 previously tracked ads are newly seller-reported sold.

The [dated refresh report](validation/refresh-2026-09-27-comparison.md) records source coverage, validation and remaining limitations. Earlier dated sections below remain historical evidence.

## September 24 inventory refresh

Published data commit [`fc2de2f`](https://github.com/PNelsonFTP/ClassicCars/commit/fc2de2f05fe8496249778f2b418ebd4db17005cd) passed the [Pages workflow](https://github.com/PNelsonFTP/ClassicCars/actions/runs/36003058178), including 268 tests across 27 files. [Live verification](validation/github-pages-2026-09-24.json) passed exact catalog/snapshot/detail hashes, search, real images, all 26 source-method panels and 1440/390/375px layouts. No runtime errors, missing local assets, active collection runs or leases remain.

The September 24 refresh retains **3,825 ads / 3,802 groups**, with **3,806 public ads / 3,789 public groups**. It added **541 ads**, recorded **229 numeric asking-price changes** (220 decreases, 9 increases), and refreshed details for **238 distinct ads**. 7 previously tracked ads are newly seller-reported sold.

See the [dated refresh report](validation/refresh-2026-09-24-comparison.md) for catalog coverage, verification and remaining detail/source limitations. Older dated sections below are historical evidence.

Final [CI run](https://github.com/PNelsonFTP/ClassicCars/actions/runs/34721449243) passed all six jobs on application/data commit `a639985`: Node 24 on Ubuntu, macOS and Windows; Node 22.18 on Ubuntu; hosted browser checks; and Docker.

## September 12 source-access release

The [source-access update](SOURCE_ACCESS.md) adds dated methods and evidence for all 26 sources, fixes identified HTTP/robots issues, and enables JWS catalog-only collection. The public snapshot now contains 3,265 ads; the eight new JWS records are explicitly sold, not newly available stock. Release validation: 268 unit/API tests, 18 desktop/mobile E2E tests, both static export paths and public redaction checks passed. No dependency versions changed; SBOM input hashes were regenerated. Deployed application/data commit: [`a639985`](https://github.com/PNelsonFTP/ClassicCars/commit/a6399850962290fbd3224d0bf2010e2a0d10a433). [Pages deployment](https://github.com/PNelsonFTP/ClassicCars/actions/runs/34721449077) and [live browser/data verification](validation/source-access-pages-2026-09-12.json) passed.

## September 12 inventory update

The requested refresh added 79 ads and rebuilt the public snapshot with 3,257 ads. All 94 accessible configured catalog pages refreshed; 226 detail checks succeeded, with two J & S Motors URLs returning 404. ClassicCars has a separate 3,026-ad detail backlog after its configured 50-detail batch. Autotrader and 500 Classic remain paused. See the [comparison](validation/refresh-2026-09-12-comparison.md) and [privacy/consistency receipt](validation/public-export-review-2026-09-12.json). The updated snapshot is live at [MuscleScout](https://pnelsonftp.github.io/ClassicCars/). [Pages deployment](https://github.com/PNelsonFTP/ClassicCars/actions/runs/34694382537) passed from inventory commit `b4e0914cded3aac8e5ee72e1cc8c91a6c37721e6`; the [live receipt](validation/github-pages-2026-09-12.json) confirms exact public-data hashes, working search/details/images and desktop/mobile layouts at 1440, 390 and 375 pixels, with no runtime errors or missing local assets. The snapshot was generated at `2026-09-12T12:40:06.377Z`. The closing documentation commit does not change the deployed inventory. The September 10 deployment record below remains historical.

## GitHub publication — September 10, 2026

The project is committed and pushed to the public [PNelsonFTP/ClassicCars repository](https://github.com/PNelsonFTP/ClassicCars). [MuscleScout is live on GitHub Pages](https://pnelsonftp.github.io/ClassicCars/) with HTTPS enforced and project base path `/ClassicCars`. The [deployment of `ea6be78`](https://github.com/PNelsonFTP/ClassicCars/actions/runs/34547932246) succeeded. Private environment files, the local database, caches, logs and backups remain excluded from Git; the redacted public snapshot is included.

Before the first public push, seven research-derived fixtures were removed from the unpublished branch history. Public replacements use wholly synthetic Autotrader records and omit real VIN/contact fields in six other fixtures. The original local history remains in a private ignored Git bundle. Only the sanitized `main` branch was pushed; private backup and tool-capture refs were not published.

The live [browser and data receipt](validation/github-pages-2026-09-10.json) confirms HTTPS 200, 3,178 public ads, exact catalog/snapshot/detail-chunk hashes, typo-tolerant search, a working detail dialog, real image loading, and no runtime errors or missing local assets. Desktop 1440px and mobile 390px/375px checks passed without horizontal overflow or a clipped Save search button. The snapshot was generated at `2026-09-10T23:06:00.330Z`; publication does not change source observation dates.

The deployed application commit is `ea6be783a46bc37d5d7656ece71b22dadfe0e2b0`. The subsequent `844e9cd` correction changes Git handling of vendored schema bytes and the implementation log; it does not change the static application or inventory. This delivery record is a documentation-only follow-up. Future snapshot updates require a new export, commit/push and manual **Publish MuscleScout snapshot** workflow run with `/ClassicCars`.

The final [GitHub CI run on `844e9cd`](https://github.com/PNelsonFTP/ClassicCars/actions/runs/34548198449) passed all six jobs:

- Node 24 on Ubuntu 24.04, Windows 2025 and macOS 15, plus Node 22.18.0 on Ubuntu: clean install, strict types, 259 tests, isolated setup/migration/SQLite/backup/restore/API smoke, SBOM generation, native inventory, schema/hash/reference validation and dependency comparison.
- Browser: 16 desktop/mobile tests, root and `/ClassicCars` builds, image and export checks.
- Container: Linux x64 Docker build, isolated release smoke and target SBOM/native/dpkg inventory.

The [permanent release receipt](validation/github-release-2026-09-10.json) records job results, artifact URLs, exact target counts and verified report hashes. GitHub retains these artifacts for 14 days; the full downloaded reports and CI log are also retained locally in the ignored `backups/github-release-34548198449.tar.gz` archive. The earlier failed runs remain visible: they exposed the Windows loader URL, npm 10 duplicate SBOM IDs and Windows schema line endings, all corrected before the passing run. No dependency versions changed and no new advisory audit is claimed.

## September 10 local refresh status

The [refresh comparison](validation/refresh-2026-09-10-comparison.md) records the latest data and outstanding source/detail limits. Both root and `/ClassicCars` exports were rebuilt and validated with 3,178 public ads. The local preview on 3100 and API on 4410 are running; the worker is off. The approved September 8 improvement commit is `42a6622`. This refresh is included in the newly authorized GitHub delivery above.

Historical September 8 status: the user approved delivery after local review, but repository selection was then pending. The September 10 publication above supersedes that hold.

## Reviewed release — September 8, 2026

- 222 unit/API tests and 16 desktop/mobile browser tests passed.
- Root and `/ClassicCars` static exports built and passed export checks.
- The final catalog scan fetched 93 fresh pages and retained 3,139 ads, including 3,120 public ads. Blocked sources and outstanding detail work remain documented.
- Clean macOS Node 24 and Linux arm64 Docker release checks passed. Host/container SBOM schema and hash checks passed; the recorded advisory query found zero vulnerabilities.
- Private environment, database, caches, logs and backups remain ignored. Public export inspection found no configured backend secrets or private listing fields.

See [validation](../VALIDATION.md), [inventory scan](validation/inventory-full-scan.json), [SBOM](../SBOM.md) and [remaining work](../FUTURE_IMPROVEMENTS.md) for exact evidence and limits.

## Runtime and retained artifacts

The task-owned web preview, API and worker were stopped and their shutdown verified on September 8. The web preview (3100) and API (4410) were restarted September 10; the worker remains off. Separate web/API commands preserve that state, while `npm run dev` also starts the worker; see [the handoff](../HANDOFF.md). No OS autostart service or Compose deployment was installed. Private backups, cached evidence and the reviewed Docker image are retained locally.

GitHub Pages serves the static frontend and dated public inventory independently of Docker. Collection, private SQLite state, routes and scheduled alerts require the local API and worker. Public HTTPS-to-local-network browser connectivity remains a separate acceptance check.
