# October 17, 2026 inventory refresh

Collection began 2026-10-17T11:42:49.925205+00:00; final comparison 2026-10-17T12:27:45.995138+00:00; public export 2026-10-17T12:27:39.782Z.

The October 17 refresh retains **4,553 ads / 4,529 groups**, including **4,534 public ads / 4,516 public groups**. It added **135 ads**, recorded **87 numeric asking-price changes** (81 decreases, 6 increases), and refreshed details for **280 distinct ads**. 2 previously tracked ads changed to seller-reported sold.

The baseline contained 4,418 retained ads / 4,394 groups and 4,399 public ads / 4,381 public groups. 3,156 distinct ads were observed in this window, including additions. 0 baseline IDs were removed. 8 existing asks became known; 4 became unknown. Source availability changed on 51 existing ads. Export generation never counts as a new observation.

## Collection coverage

96 catalog responses; 280 successful detail checks / 281 attempts; 0 catalog failures; 1 detail failure; 0 cache hits.

| Source | Retained before → after | Added | Observed | Fresh detail ads | Ask changes | Catalog pages | Detail successes / attempts |
|---|---:|---:|---:|---:|---:|---:|---:|
| 500classic | 3 → 3 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| admcars | 46 → 46 | 0 | 46 | 46 | 0 | 4 | 46 / 46 |
| autotrader | 19 → 19 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| classiccars | 4157 → 4289 | 132 | 2918 | 50 | 85 | 75 | 50 / 50 |
| grauto | 78 → 81 | 3 | 80 | 80 | 2 | 5 | 80 / 80 |
| jsmotors | 25 → 25 | 0 | 22 | 22 | 0 | 2 | 22 / 23 |
| jws | 8 → 8 | 0 | 8 | 0 | 0 | 1 | 0 / 0 |
| midwest | 3 → 3 | 0 | 3 | 3 | 0 | 1 | 3 / 3 |
| nsclassics | 14 → 14 | 0 | 14 | 14 | 0 | 6 | 14 / 14 |
| volo | 65 → 65 | 0 | 65 | 65 | 0 | 2 | 65 / 65 |

| Catalog | Complete | Pending | Blocked |
|---|---:|---:|---:|
| midwest / regional | 1 | 0 | 0 |
| classiccars / nationwide | 49 | 0 | 0 |
| classiccars / regional | 26 | 0 | 0 |
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
| classiccars | 4239 | 0 | 50 | 50 | active |
| volo | 0 | 0 | 65 | 65 | active |
| grauto | 0 | 1 | 80 | 80 | active |
| admcars | 0 | 0 | 46 | 46 | active |
| nsclassics | 0 | 0 | 14 | 14 | active |
| jsmotors | 0 | 3 | 22 | 22 | active |
| 500classic | 0 | 3 | 0 | 0 | review |
| autotrader | 1 | 18 | 0 | 0 | review |
| jws | 8 | 0 | 0 | 0 | active |

Today’s J & S detail request for `jsmotors:1984-corvette-coupe-1` returned HTTP 404. Its task is blocked; J & S remains active and its 22 other detail checks succeeded. The prior observation is retained, and the missing page is not evidence of a sale.

The GR Auto `grauto:bw4470` detail task remains blocked following its October 13 HTTP 404. The two J & S 404 tasks known before this refresh also remain blocked; the newly missing J & S page is documented separately above. Previous observations are retained; missing detail pages are not proof of sales. This refresh does not redate those earlier failures.

ClassicCars detail enrichment remains a separate bounded 50-ad batch. Queue counts above are unique tasks across scopes. Fresh completed tasks are within the configured freshness window at comparison time: 24 hours for fixed-price ads, one hour for auctions. Completed this window counts only today’s checks. Due counts include deferred retries; remaining due work is not proof of an access failure. JWS remains catalog-only, with its eight retained matching cars explicitly sold and their asking prices unknown. Existing J & S 404 tasks remain blocked; absence from a catalog is not treated as proof of a sale.

500 Classic and Autotrader remain paused without new requests. Disabled/restricted sources, missing provider permissions and cross-listing uncertainty remain documented in [source access](../SOURCE_ACCESS.md) and [future improvements](../../FUTURE_IMPROVEMENTS.md). This refresh does not redate that access audit. The known lifetime-attempt retry behavior remains unchanged. Ads and groups are not verified unique physical vehicles; actual fresh road routes are still required for strict drive-time matches.

## Validation and operations

Regional collection used `npm run collect -- --fresh --pages=50000 --details=50`; national catalogs used `npm run collect -- --source=classiccars --nationwide --fresh --pages=50000 --details=0`. Remaining Volo and GR Auto detail tasks were attempted with source-specific `--fresh --pages=0 --details=100` batches. Source rate limits and settings were preserved.

Private backups were made before and after collection. The automatic worker was not started; collection finished with no running ingest runs or leases. Root and `/ClassicCars` builds passed. [Public export checks](public-export-review-2026-10-17.json) verified exact redaction/freshness against local records, all detail chunks and hashes, positive/null asks, absence of obsolete chunks, matching built copies and configured-secret exclusion. [Browser checks](static-review-2026-10-17.json) verified both static paths, real images and isolated browser workspaces without runtime or local-asset errors.

Application code, configuration, dependencies and lockfile are unchanged. Earlier platform, SBOM and security-audit receipts keep their original dates. Baselines, raw seller evidence, credentials and database backups remain private and ignored by Git. The public snapshot excludes the 19 retained Autotrader ads.

[Aggregate refresh evidence](refresh-2026-10-17.json).
