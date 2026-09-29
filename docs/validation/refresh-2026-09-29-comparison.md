# September 29, 2026 inventory refresh

Collection began 2026-09-29T23:02:00.590515+00:00; final comparison 2026-09-29T23:42:45.847016+00:00; public export 2026-09-29T23:42:45.411Z.

The September 29 refresh retains **4,001 ads / 3,978 groups**, including **3,982 public ads / 3,965 public groups**. It added **64 ads**, recorded **21 numeric asking-price changes** (18 decreases, 3 increases), and refreshed details for **260 distinct ads**. No previously tracked ads were newly seller-reported sold.

The baseline contained 3,937 retained ads / 3,914 groups and 3,918 public ads / 3,901 public groups. 3,097 distinct ads were observed in this window, including additions. 0 baseline IDs were removed. 4 existing asks became known; 1 became unknown. Source availability changed on 52 existing ads. Export generation never counts as a new observation.

## Collection coverage

96 catalog responses; 260 successful detail checks / 260 attempts; 0 catalog failures; 0 detail failures; 0 cache hits.

| Source | Retained before → after | Added | Observed | Fresh detail ads | Ask changes | Catalog pages | Detail successes / attempts |
|---|---:|---:|---:|---:|---:|---:|---:|
| 500classic | 3 → 3 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| admcars | 40 → 46 | 6 | 46 | 46 | 0 | 4 | 46 / 46 |
| autotrader | 19 → 19 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| classiccars | 3709 → 3759 | 50 | 2879 | 50 | 20 | 75 | 50 / 50 |
| grauto | 59 → 64 | 5 | 64 | 64 | 1 | 5 | 64 / 64 |
| jsmotors | 25 → 25 | 0 | 23 | 23 | 0 | 2 | 23 / 23 |
| jws | 8 → 8 | 0 | 8 | 0 | 0 | 1 | 0 / 0 |
| midwest | 3 → 3 | 0 | 3 | 3 | 0 | 1 | 3 / 3 |
| nsclassics | 14 → 14 | 0 | 14 | 14 | 0 | 6 | 14 / 14 |
| volo | 57 → 60 | 3 | 60 | 60 | 0 | 2 | 60 / 60 |

| Catalog | Complete | Pending | Blocked |
|---|---:|---:|---:|
| midwest / regional | 1 | 0 | 0 |
| classiccars / nationwide | 50 | 0 | 0 |
| classiccars / regional | 25 | 0 | 0 |
| volo / regional | 2 | 0 | 0 |
| grauto / regional | 5 | 0 | 0 |
| admcars / regional | 4 | 0 | 0 |
| nsclassics / regional | 6 | 0 | 0 |
| jsmotors / regional | 2 | 0 | 0 |
| 500classic / regional | 0 | 1 | 0 |
| autotrader / regional | 0 | 1 | 0 |
| jws / regional | 1 | 0 | 0 |

## Remaining work and limits

| Source | Due detail tasks | Blocked detail tasks | Fresh completed tasks | Current health |
|---|---:|---:|---:|---|
| 500classic | 0 | 3 | 0 | review |
| admcars | 0 | 0 | 46 | active |
| autotrader | 1 | 18 | 0 | review |
| classiccars | 3709 | 0 | 50 | active |
| grauto | 0 | 0 | 64 | active |
| jsmotors | 0 | 2 | 23 | active |
| jws | 8 | 0 | 0 | active |
| midwest | 0 | 0 | 3 | active |
| nsclassics | 0 | 0 | 14 | active |
| volo | 0 | 0 | 60 | active |

ClassicCars detail enrichment remains a separate bounded 50-ad batch. Queue counts above are unique tasks across scopes; remaining due work is not proof of an access failure. JWS remains catalog-only, with its eight retained matching cars explicitly sold and their asking prices unknown. Existing J & S 404 tasks remain blocked; absence from a catalog is not treated as proof of a sale.

500 Classic and Autotrader remain paused without new requests. Disabled/restricted sources, missing provider permissions and cross-listing uncertainty remain documented in [source access](../SOURCE_ACCESS.md) and [future improvements](../../FUTURE_IMPROVEMENTS.md). This refresh does not redate that access audit. The known lifetime-attempt retry behavior remains unchanged. Ads and groups are not verified unique physical vehicles; actual fresh road routes are still required for strict drive-time matches.

## Validation and operations

Regional collection used `npm run collect -- --fresh --pages=50000 --details=50`; national catalogs used `npm run collect -- --source=classiccars --nationwide --fresh --pages=50000 --details=0`. Remaining small dealer details were completed with source-specific `--fresh --pages=0 --details=100` batches. Source rate limits and settings were preserved.

Private backups were made before and after collection. The automatic worker was not started; collection finished with no running ingest runs or leases. Root and `/ClassicCars` builds passed. [Public export checks](public-export-review-2026-09-29.json) verified exact redaction/freshness against local records, all detail chunks and hashes, positive/null asks, absence of obsolete chunks, matching built copies and configured-secret exclusion. [Browser checks](static-review-2026-09-29.json) verified both static paths, real images and isolated browser workspaces without runtime or local-asset errors.

Application code, configuration, dependencies and lockfile are unchanged. Earlier platform, SBOM and security-audit receipts keep their original dates. Baselines, raw seller evidence, credentials and database backups remain private and ignored by Git. The public snapshot excludes the 19 retained Autotrader ads.

[Aggregate refresh evidence](refresh-2026-09-29.json).

## Publication

The [Pages deployment](https://github.com/PNelsonFTP/ClassicCars/actions/runs/36646771561) succeeded for `80014f325d8f3edc6abac81cdb07db40372e3246`, including type checks and all 269 tests in 27 files. The [live receipt](github-pages-2026-09-29.json) verifies 3,982 public ads, exact exported data hashes, search, lazy details, images and desktop/mobile layouts. Later documentation-only commits record the receipt and do not change the deployed application/data.
