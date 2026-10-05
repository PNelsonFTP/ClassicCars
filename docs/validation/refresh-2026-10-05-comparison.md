# October 5, 2026 inventory refresh

Collection began 2026-10-05T12:13:57.855637+00:00; final comparison 2026-10-05T12:26:21.488294+00:00; public export 2026-10-05T12:26:18.211Z.

The October 5 refresh retains **4,177 ads / 4,154 groups**, including **4,158 public ads / 4,141 public groups**. It added **9 ads**, recorded **7 numeric asking-price changes** (6 decreases, 1 increase), and refreshed details for **50 distinct ads**. No previously tracked ads changed to seller-reported sold.

The baseline contained 4,168 retained ads / 4,145 groups and 4,149 public ads / 4,132 public groups. 3,074 distinct ads were observed in this window, including additions. 0 baseline IDs were removed. 5 existing asks became known; 1 became unknown. Source availability changed on 50 existing ads. Export generation never counts as a new observation.

## Collection coverage

96 catalog responses; 50 successful detail checks / 50 attempts; 0 catalog failures; 0 detail failures; 0 cache hits.

| Source | Retained before → after | Added | Observed | Fresh detail ads | Ask changes | Catalog pages | Detail successes / attempts |
|---|---:|---:|---:|---:|---:|---:|---:|
| 500classic | 3 → 3 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| admcars | 46 → 46 | 0 | 38 | 0 | 0 | 4 | 0 / 0 |
| autotrader | 19 → 19 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| classiccars | 3921 → 3930 | 9 | 2890 | 50 | 7 | 75 | 50 / 50 |
| grauto | 69 → 69 | 0 | 51 | 0 | 0 | 5 | 0 / 0 |
| jsmotors | 25 → 25 | 0 | 23 | 0 | 0 | 2 | 0 / 0 |
| jws | 8 → 8 | 0 | 8 | 0 | 0 | 1 | 0 / 0 |
| midwest | 3 → 3 | 0 | 3 | 0 | 0 | 1 | 0 / 0 |
| nsclassics | 14 → 14 | 0 | 13 | 0 | 0 | 6 | 0 / 0 |
| volo | 60 → 60 | 0 | 48 | 0 | 0 | 2 | 0 / 0 |

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

| Source | Due detail tasks | Blocked detail tasks | Fresh completed tasks | Completed this window | Current health |
|---|---:|---:|---:|---:|---|
| midwest | 0 | 0 | 3 | 0 | active |
| classiccars | 3830 | 0 | 100 | 50 | active |
| volo | 0 | 0 | 60 | 0 | active |
| grauto | 0 | 0 | 69 | 0 | active |
| admcars | 0 | 0 | 46 | 0 | active |
| nsclassics | 0 | 0 | 14 | 0 | active |
| jsmotors | 0 | 2 | 23 | 0 | active |
| 500classic | 0 | 3 | 0 | 0 | review |
| autotrader | 1 | 18 | 0 | 0 | review |
| jws | 8 | 0 | 0 | 0 | active |

ClassicCars detail enrichment remains a separate bounded 50-ad batch. Queue counts above are unique tasks across scopes. Fresh completed tasks include still-current checks from yesterday: 24 hours for fixed-price ads, one hour for auctions. Completed this window counts only today’s checks. Due counts include deferred retries; remaining due work is not proof of an access failure. JWS remains catalog-only, with its eight retained matching cars explicitly sold and their asking prices unknown. Existing J & S 404 tasks remain blocked; absence from a catalog is not treated as proof of a sale.

500 Classic and Autotrader remain paused without new requests. Disabled/restricted sources, missing provider permissions and cross-listing uncertainty remain documented in [source access](../SOURCE_ACCESS.md) and [future improvements](../../FUTURE_IMPROVEMENTS.md). This refresh does not redate that access audit. The known lifetime-attempt retry behavior remains unchanged. Ads and groups are not verified unique physical vehicles; actual fresh road routes are still required for strict drive-time matches.

## Validation and operations

Regional collection used `npm run collect -- --fresh --pages=50000 --details=50`; national catalogs used `npm run collect -- --source=classiccars --nationwide --fresh --pages=50000 --details=0`. Dealer details already within the configured freshness window were retained without relabeling yesterday’s observations as today’s. Source rate limits and settings were preserved.

Private backups were made before and after collection. The automatic worker was not started; collection finished with no running ingest runs or leases. Root and `/ClassicCars` builds passed. [Public export checks](public-export-review-2026-10-05.json) verified exact redaction/freshness against local records, all detail chunks and hashes, positive/null asks, absence of obsolete chunks, matching built copies and configured-secret exclusion. [Browser checks](static-review-2026-10-05.json) verified both static paths, real images and isolated browser workspaces without runtime or local-asset errors.

Application code, configuration, dependencies and lockfile are unchanged. Earlier platform, SBOM and security-audit receipts keep their original dates. Baselines, raw seller evidence, credentials and database backups remain private and ignored by Git. The public snapshot excludes the 19 retained Autotrader ads.

[Aggregate refresh evidence](refresh-2026-10-05.json).
