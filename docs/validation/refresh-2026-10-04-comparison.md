# October 4, 2026 inventory refresh

Collection began 2026-10-04T12:42:27.723428+00:00; final comparison 2026-10-04T13:24:16.875435+00:00; public export 2026-10-04T13:24:13.878Z.

The October 4 refresh retains **4,168 ads / 4,145 groups**, including **4,149 public ads / 4,132 public groups**. It added **112 ads**, recorded **73 numeric asking-price changes** (68 decreases, 5 increases), and refreshed details for **265 distinct ads**. One previously tracked ad is newly seller-reported sold.

The baseline contained 4,056 retained ads / 4,033 groups and 4,037 public ads / 4,020 public groups. 3,116 distinct ads were observed in this window, including additions. 0 baseline IDs were removed. 5 existing asks became known; 1 became unknown. Source availability changed on 51 existing ads. Export generation never counts as a new observation.

## Collection coverage

96 catalog responses; 265 successful detail checks / 265 attempts; 0 catalog failures; 0 detail failures; 0 cache hits.

| Source | Retained before → after | Added | Observed | Fresh detail ads | Ask changes | Catalog pages | Detail successes / attempts |
|---|---:|---:|---:|---:|---:|---:|---:|
| 500classic | 3 → 3 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| admcars | 46 → 46 | 0 | 46 | 46 | 0 | 4 | 46 / 46 |
| autotrader | 19 → 19 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| classiccars | 3811 → 3921 | 110 | 2893 | 50 | 70 | 75 | 50 / 50 |
| grauto | 67 → 69 | 2 | 69 | 69 | 3 | 5 | 69 / 69 |
| jsmotors | 25 → 25 | 0 | 23 | 23 | 0 | 2 | 23 / 23 |
| jws | 8 → 8 | 0 | 8 | 0 | 0 | 1 | 0 / 0 |
| midwest | 3 → 3 | 0 | 3 | 3 | 0 | 1 | 3 / 3 |
| nsclassics | 14 → 14 | 0 | 14 | 14 | 0 | 6 | 14 / 14 |
| volo | 60 → 60 | 0 | 60 | 60 | 0 | 2 | 60 / 60 |

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
| midwest | 0 | 0 | 3 | active |
| classiccars | 3871 | 0 | 50 | active |
| volo | 0 | 0 | 60 | active |
| grauto | 0 | 0 | 69 | active |
| admcars | 0 | 0 | 46 | active |
| nsclassics | 0 | 0 | 14 | active |
| jsmotors | 0 | 2 | 23 | active |
| 500classic | 0 | 3 | 0 | review |
| autotrader | 1 | 18 | 0 | review |
| jws | 8 | 0 | 0 | active |

ClassicCars detail enrichment remains a separate bounded 50-ad batch. Queue counts above are unique tasks across scopes; remaining due work is not proof of an access failure. JWS remains catalog-only, with its eight retained matching cars explicitly sold and their asking prices unknown. Existing J & S 404 tasks remain blocked; absence from a catalog is not treated as proof of a sale.

500 Classic and Autotrader remain paused without new requests. Disabled/restricted sources, missing provider permissions and cross-listing uncertainty remain documented in [source access](../SOURCE_ACCESS.md) and [future improvements](../../FUTURE_IMPROVEMENTS.md). This refresh does not redate that access audit. The known lifetime-attempt retry behavior remains unchanged. Ads and groups are not verified unique physical vehicles; actual fresh road routes are still required for strict drive-time matches.

## Validation and operations

Regional collection used `npm run collect -- --fresh --pages=50000 --details=50`; national catalogs used `npm run collect -- --source=classiccars --nationwide --fresh --pages=50000 --details=0`. Remaining small dealer details were completed with source-specific `--fresh --pages=0 --details=100` batches. Source rate limits and settings were preserved.

Private backups were made before and after collection. The automatic worker was not started; collection finished with no running ingest runs or leases. Root and `/ClassicCars` builds passed. [Public export checks](public-export-review-2026-10-04.json) verified exact redaction/freshness against local records, all detail chunks and hashes, positive/null asks, absence of obsolete chunks, matching built copies and configured-secret exclusion. [Browser checks](static-review-2026-10-04.json) verified both static paths, real images and isolated browser workspaces without runtime or local-asset errors.

Application code, configuration, dependencies and lockfile are unchanged. Earlier platform, SBOM and security-audit receipts keep their original dates. Baselines, raw seller evidence, credentials and database backups remain private and ignored by Git. The public snapshot excludes the 19 retained Autotrader ads.

[Aggregate refresh evidence](refresh-2026-10-04.json).
