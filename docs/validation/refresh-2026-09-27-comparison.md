# September 27, 2026 inventory refresh

Collection began 2026-09-27T20:04:56.205731+00:00; final comparison 2026-09-27T20:45:02.544233+00:00; public export 2026-09-27T20:44:53.308Z.

The September 27 refresh retains **3,937 ads / 3,914 groups**, including **3,918 public ads / 3,901 public groups**. It added **112 ads**, recorded **61 numeric asking-price changes** (50 decreases, 11 increases), and refreshed details for **246 distinct ads**. 2 previously tracked ads are newly seller-reported sold.

The baseline contained 3,825 retained ads / 3,802 groups and 3,806 public ads / 3,789 public groups. 3,063 distinct ads were observed in this window, including additions. 0 baseline IDs were removed. 9 existing asks became known; 4 became unknown. Source availability changed on 52 existing ads. Export generation never counts as a new observation.

## Collection coverage

102 catalog responses (96 completed pages in the final checkpoints, plus North Shore validation/recheck requests); 246 successful detail checks / 247 attempts; 0 catalog failures; 1 detail failure; 0 cache hits.

| Source | Retained before → after | Added | Observed | Fresh detail ads | Ask changes | Catalog pages | Detail successes / attempts |
|---|---:|---:|---:|---:|---:|---:|---:|
| 500classic | 3 → 3 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| admcars | 38 → 40 | 2 | 40 | 40 | 0 | 4 | 40 / 40 |
| autotrader | 19 → 19 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| classiccars | 3605 → 3709 | 104 | 2859 | 50 | 61 | 75 | 50 / 50 |
| grauto | 57 → 59 | 2 | 59 | 59 | 0 | 5 | 59 / 59 |
| jsmotors | 24 → 25 | 1 | 23 | 23 | 0 | 2 | 23 / 23 |
| jws | 8 → 8 | 0 | 8 | 0 | 0 | 1 | 0 / 0 |
| midwest | 3 → 3 | 0 | 3 | 3 | 0 | 1 | 3 / 3 |
| nsclassics | 13 → 14 | 1 | 14 | 14 | 0 | 12 | 14 / 15 |
| volo | 55 → 57 | 2 | 57 | 57 | 0 | 2 | 57 / 57 |

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
| admcars | 0 | 0 | 40 | active |
| autotrader | 1 | 18 | 0 | review |
| classiccars | 3659 | 0 | 50 | active |
| grauto | 0 | 0 | 59 | active |
| jsmotors | 0 | 2 | 23 | active |
| jws | 8 | 0 | 0 | active |
| midwest | 0 | 0 | 3 | active |
| nsclassics | 0 | 0 | 14 | active |
| volo | 0 | 0 | 57 | active |

ClassicCars detail enrichment remains a separate bounded 50-ad batch. Queue counts above are unique tasks across scopes; remaining due work is not proof of an access failure. JWS remains catalog-only, with its eight retained matching cars explicitly sold and their asking prices unknown. Existing J & S 404 tasks remain blocked; absence from a catalog is not treated as proof of a sale.

500 Classic and Autotrader remain paused without new requests. Disabled/restricted sources, missing provider permissions and cross-listing uncertainty remain documented in [source access](../SOURCE_ACCESS.md) and [future improvements](../../FUTURE_IMPROVEMENTS.md). This refresh does not redate that access audit. The known lifetime-attempt retry behavior remains unchanged. Ads and groups are not verified unique physical vehicles; actual fresh road routes are still required for strict drive-time matches.

## Validation and operations

Regional collection used `npm run collect -- --fresh --pages=50000 --details=50`; national catalogs used `npm run collect -- --source=classiccars --nationwide --fresh --pages=50000 --details=0`. After the targeted parser repair, North Shore was reviewed, its failed task reopened, and an ordinary live catalog/detail smoke check required before resuming. North Shore then completed a fresh `--pages=50000 --details=100` catalog/detail pass; Volo and GR remainders used source-specific `--fresh --pages=0 --details=100` batches. Source rate limits and settings were preserved.

Private backups were made before and after collection. The automatic worker was not started; collection finished with no running ingest runs or leases. Root and `/ClassicCars` builds passed. [Public export checks](public-export-review-2026-09-27.json) verified exact redaction/freshness against local records, all detail chunks and hashes, positive/null asks, absence of obsolete chunks, matching built copies and configured-secret exclusion. [Browser checks](static-review-2026-09-27.json) verified both static paths, real images and isolated browser workspaces without runtime or local-asset errors.

The North Shore detail parser now recognizes an explicit CALL FOR PRICE label on an otherwise populated, exact-identity page. Missing narrative and a nonnumeric ask no longer trigger a false empty-page pause; the ask remains null and priceOnRequest is true. Numeric prices clear that flag. All 269 tests across 27 files passed locally. Regression coverage checks unknown prices, stale numeric-price removal, wrong identities and insufficient-field shells. Configuration, dependencies and lockfile are unchanged. Earlier platform, SBOM and security-audit receipts keep their original dates. Baselines, raw seller evidence, credentials and database backups remain private and ignored by Git. The public snapshot excludes the 19 retained Autotrader ads.

[Aggregate refresh evidence](refresh-2026-09-27.json).

## Publication

The [Pages deployment](https://github.com/PNelsonFTP/ClassicCars/actions/runs/36349304979) succeeded for `b014782e82f1986fa473c1cfde171451b70a3171`, including type checks and all 269 tests in 27 files. The [live receipt](github-pages-2026-09-27.json) verifies 3,918 public ads, exact exported data hashes, search, lazy details, images and desktop/mobile layouts. Later documentation-only commits record the receipts and do not change the deployed application/data.

All six jobs in the [CI run](https://github.com/PNelsonFTP/ClassicCars/actions/runs/36349302914) passed for the deployed commit: Node 24 on Linux/macOS/Windows, Node 22.18 on Linux, hosted browser checks and Docker. [CI receipt](github-ci-2026-09-27.json).

