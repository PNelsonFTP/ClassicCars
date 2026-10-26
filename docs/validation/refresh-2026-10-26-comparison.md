# October 26, 2026 inventory refresh

Collection began 2026-10-26T13:51:37.729Z; comparison 2026-10-26T14:42:41.493Z; public export 2026-10-26T14:42:34.187Z.

The October 26 refresh retains **4,737 ads / 4,711 groups**, including **4,718 public ads / 4,698 public groups**. It added **159 ads**, recorded **186 numeric asking-price changes** (106 decreases, 80 increases), and refreshed details for **290 distinct ads**. **1 previously tracked ad** is newly seller-reported sold.

The baseline contained 4,578 retained ads / 4,552 groups and 4,559 public ads / 4,539 groups. 3,137 distinct ads were observed in this refresh window. No baseline IDs were removed. 10 existing asks became known and 8 became unknown. Projected availability changed on 51 existing ads; age-based stale status is separate from seller-reported sales. Ads/groups are not verified unique physical vehicles.

## Collection coverage

95 catalog responses; 332 successful detail checks / 332 attempts; 0 catalog failures; 0 detail failures; 22 cache hits. Fresh requests retain each source's configured delays, access settings and daily budgets.

| Source | Retained before → after | Added | Observed | Fresh detail ads | Ask changes | Catalog pages | Detail successes / attempts |
|---|---:|---:|---:|---:|---:|---:|---:|
| 500classic | 3 → 3 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| admcars | 46 → 47 | 1 | 47 | 47 | 0 | 4 | 47 / 47 |
| autotrader | 19 → 19 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| classiccars | 4313 → 4463 | 150 | 2889 | 50 | 180 | 75 | 50 / 50 |
| grauto | 81 → 86 | 5 | 85 | 85 | 6 | 5 | 127 / 127 |
| jsmotors | 25 → 25 | 0 | 22 | 22 | 0 | 2 | 22 / 22 |
| jws | 8 → 8 | 0 | 8 | 0 | 0 | 1 | 0 / 0 |
| midwest | 3 → 3 | 0 | 3 | 3 | 0 | 1 | 3 / 3 |
| nsclassics | 14 → 14 | 0 | 14 | 14 | 0 | 5 | 14 / 14 |
| volo | 66 → 69 | 3 | 69 | 69 | 0 | 2 | 69 / 69 |

| Refreshed catalog | Complete | Pending | Blocked |
|---|---:|---:|---:|
| midwest / regional | 1 | 0 | 0 |
| classiccars / nationwide | 50 | 0 | 0 |
| classiccars / regional | 25 | 0 | 0 |
| volo / regional | 2 | 0 | 0 |
| grauto / regional | 5 | 0 | 0 |
| admcars / regional | 4 | 0 | 0 |
| nsclassics / regional | 5 | 0 | 0 |
| jsmotors / regional | 2 | 0 | 0 |
| jws / regional | 1 | 0 | 0 |

## Remaining detail work and access limits

| Source | Due detail tasks | Blocked detail tasks | Fresh completed tasks | Current health |
|---|---:|---:|---:|---|
| 500classic | 0 | 3 | 0 | review |
| admcars | 0 | 0 | 47 | active |
| autotrader | 1 | 18 | 0 | review |
| classiccars | 4459 | 0 | 4 | active |
| grauto | 0 | 1 | 85 | active |
| jsmotors | 0 | 3 | 22 | active |
| jws | 8 | 0 | 0 | active |
| midwest | 0 | 0 | 3 | active |
| nsclassics | 0 | 0 | 14 | active |
| volo | 0 | 0 | 69 | active |

ClassicCars detail enrichment remains a bounded batch; its pending/older details are not evidence of failed catalog discovery. Due counts include deferred retries and are unique tasks across scopes. Fresh completed tasks are within the configured cache window at comparison time. JWS is catalog-only; its retained matching cars remain explicitly sold unless the source actually reports a different status.

GR Auto's forced continuation selected some detail pages already fetched earlier in this refresh. That task was cooperatively stopped and resumed with the existing freshness-aware cache; older pages still required live requests, and same-day cache reads retained their original observation timestamps. Attempt/check counts therefore differ from unique fresh detail ads; a cancelled attempt is not a source failure. Reducing redundant same-day task selection remains an efficiency follow-up rather than a claim of missing inventory.

500 Classic and Autotrader retain their prior review pauses without new requests. Disabled/restricted sources and provider permissions remain unchanged. Prior GR Auto and J & S missing detail pages retain their original evidence dates. New failures, if any, are counted above and preserved in private run evidence. A missing page or catalog omission never establishes a sale/removal. The source-access audit remains dated evidence rather than a claim that every source was checked today. See [source access](../SOURCE_ACCESS.md) and [remaining improvements](../../FUTURE_IMPROVEMENTS.md).

## Approximate travel and location

The travel export supplies **1,493 ads with road estimates from 148 shared city routes**. Default about-four-hour discovery returns **498 ads**, using the selected origin and planning policy. Geographic generation does not renew seller observations. The retained US Midwest road graph is dated 2026-10-20T20:23:47Z; ferries remain excluded and estimates contain no live traffic. Census/ZIP references retain their original provenance. Unsupported destinations/origins remain explicit rather than receiving invented drive times.

## Verification and operation

Regional collection used fresh configured catalogs with a 50-detail cap per source. Nationwide ClassicCars catalogs were refreshed separately; remaining dealer detail work used source-specific bounded continuation passes. Private database/environment backups were retained before and after refresh. No automatic worker was started; no ingest runs or leases remained active at final comparison.

Strict TypeScript, **305 unit tests in 29 files**, **20 desktop/mobile browser tests**, isolated release smoke, both static export paths, browser export checks, public travel/privacy/parity checks and the seven-report SBOM chain pass. The browser tests ran in a separate temporary copy after a nested test-copy startup timeout; the passing run preserves the original test evidence and private workspace. [Public export verification](public-export-review-2026-10-26.json) checks exact canonical redaction, dates, catalog/detail hashes, obsolete chunk removal and configured credential exclusion. [Travel verification](travel-refresh-2026-10-26.json) records geographic coverage and reference checks.

Application code, collection settings, dependencies and lockfile are unchanged. Baselines, raw seller evidence, credentials, databases and recovery copies remain private and ignored. The public snapshot excludes the configured restricted observations.

[Aggregate refresh evidence](refresh-2026-10-26.json). Publication results are recorded separately in [delivery status](../DELIVERY.md).
