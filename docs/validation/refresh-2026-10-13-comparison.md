# October 13, 2026 inventory refresh

Collection began 2026-10-13T12:25:54.227497+00:00; final comparison 2026-10-13T13:10:18.672846+00:00; public export 2026-10-13T13:10:12.489Z.

The October 13 refresh retains **4,418 ads / 4,394 groups**, including **4,399 public ads / 4,381 public groups**. It added **91 ads**, recorded **66 numeric asking-price changes** (53 decreases, 13 increases), and refreshed details for **278 distinct ads**. One previously tracked ad changed to seller-reported sold.

The baseline contained 4,327 retained ads / 4,304 groups and 4,308 public ads / 4,291 public groups. 3,141 distinct ads were observed in this window, including additions. 0 baseline IDs were removed. 12 existing asks became known; 2 became unknown. Source availability changed on 51 existing ads. Export generation never counts as a new observation.

## Collection coverage

95 catalog responses; 278 successful detail checks / 279 attempts; 0 catalog failures; 1 detail failure; 0 cache hits.

| Source | Retained before → after | Added | Observed | Fresh detail ads | Ask changes | Catalog pages | Detail successes / attempts |
|---|---:|---:|---:|---:|---:|---:|---:|
| 500classic | 3 → 3 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| admcars | 46 → 46 | 0 | 46 | 46 | 1 | 4 | 46 / 46 |
| autotrader | 19 → 19 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| classiccars | 4072 → 4157 | 85 | 2905 | 50 | 62 | 74 | 50 / 50 |
| grauto | 73 → 78 | 5 | 77 | 77 | 3 | 5 | 77 / 78 |
| jsmotors | 25 → 25 | 0 | 23 | 23 | 0 | 2 | 23 / 23 |
| jws | 8 → 8 | 0 | 8 | 0 | 0 | 1 | 0 / 0 |
| midwest | 3 → 3 | 0 | 3 | 3 | 0 | 1 | 3 / 3 |
| nsclassics | 14 → 14 | 0 | 14 | 14 | 0 | 6 | 14 / 14 |
| volo | 64 → 65 | 1 | 65 | 65 | 0 | 2 | 65 / 65 |

| Catalog | Complete | Pending | Blocked |
|---|---:|---:|---:|
| midwest / regional | 1 | 0 | 0 |
| classiccars / nationwide | 49 | 0 | 0 |
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

| Source | Due detail tasks | Blocked detail tasks | Fresh completed tasks | Completed this window | Current health |
|---|---:|---:|---:|---:|---|
| midwest | 0 | 0 | 3 | 3 | active |
| classiccars | 4107 | 0 | 50 | 50 | active |
| volo | 0 | 0 | 65 | 65 | active |
| grauto | 0 | 1 | 77 | 77 | active |
| admcars | 0 | 0 | 46 | 46 | active |
| nsclassics | 0 | 0 | 14 | 14 | active |
| jsmotors | 0 | 2 | 23 | 23 | active |
| 500classic | 0 | 3 | 0 | 0 | review |
| autotrader | 1 | 18 | 0 | 0 | review |
| jws | 8 | 0 | 0 | 0 | active |

Today’s GR Auto detail request for `grauto:bw4470` (1981 Chevrolet Corvette) returned HTTP 404. Its detail task is blocked; GR Auto remains active and its other checks succeeded. The previous observation is retained, and a missing page is not evidence of a sale.

ClassicCars detail enrichment remains a separate bounded 50-ad batch. Queue counts above are unique tasks across scopes. Fresh completed tasks are within the configured freshness window at comparison time: 24 hours for fixed-price ads, one hour for auctions. Completed this window counts only today’s checks. Due counts include deferred retries; remaining due work is not proof of an access failure. JWS remains catalog-only, with its eight retained matching cars explicitly sold and their asking prices unknown. Existing J & S 404 tasks remain blocked; absence from a catalog is not treated as proof of a sale.

500 Classic and Autotrader remain paused without new requests. Disabled/restricted sources, missing provider permissions and cross-listing uncertainty remain documented in [source access](../SOURCE_ACCESS.md) and [future improvements](../../FUTURE_IMPROVEMENTS.md). This refresh does not redate that access audit. The known lifetime-attempt retry behavior remains unchanged. Ads and groups are not verified unique physical vehicles; actual fresh road routes are still required for strict drive-time matches.

## Validation and operations

Regional collection used `npm run collect -- --fresh --pages=50000 --details=50`; national catalogs used `npm run collect -- --source=classiccars --nationwide --fresh --pages=50000 --details=0`. Remaining Volo and GR Auto detail tasks were attempted with source-specific `--fresh --pages=0 --details=100` batches. Source rate limits and settings were preserved.

Private backups were made before and after collection. The automatic worker was not started; collection finished with no running ingest runs or leases. Root and `/ClassicCars` builds passed. [Public export checks](public-export-review-2026-10-13.json) verified exact redaction/freshness against local records, all detail chunks and hashes, positive/null asks, absence of obsolete chunks, matching built copies and configured-secret exclusion. [Browser checks](static-review-2026-10-13.json) verified both static paths, real images and isolated browser workspaces without runtime or local-asset errors.

Application code, configuration, dependencies and lockfile are unchanged. Earlier platform, SBOM and security-audit receipts keep their original dates. Baselines, raw seller evidence, credentials and database backups remain private and ignored by Git. The public snapshot excludes the 19 retained Autotrader ads.

[Aggregate refresh evidence](refresh-2026-10-13.json).
