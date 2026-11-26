# November 26, 2026 inventory refresh

Collection began 2026-11-26T13:58:01.047Z; comparison 2026-11-26T14:49:35.310Z; public export 2026-11-26T14:49:32.419Z.

The November 26 refresh retains **5,469 ads / 5,432 groups**, including **5,450 public ads / 5,419 public groups**. It added **87 ads**, recorded **70 numeric asking-price changes** (67 decreases, 3 increases), and refreshed details for **329 distinct ads**. **4 previously tracked ads** are newly seller-reported sold.

The baseline contained 5,382 retained ads / 5,346 groups and 5,363 public ads / 5,333 groups. 3,104 distinct ads were observed in this refresh window. No baseline IDs were removed. 4 existing asks became known and 3 became unknown. Projected availability changed on 29 existing ads; age-based stale status is separate from seller-reported sales. Ads/groups are not verified unique physical vehicles.

## Collection coverage

93 catalog responses; 329 successful detail checks / 329 attempts; 0 catalog failures; 0 detail failures; 0 cache hits. Fresh requests retain each source's configured delays, access settings and daily budgets.

| Source | Retained before → after | Added | Observed | Fresh detail ads | Ask changes | Catalog pages | Detail successes / attempts |
|---|---:|---:|---:|---:|---:|---:|---:|
| 500classic | 3 → 3 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| admcars | 51 → 51 | 0 | 51 | 51 | 4 | 4 | 51 / 51 |
| autotrader | 19 → 19 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| classiccars | 5074 → 5155 | 81 | 2817 | 50 | 59 | 73 | 50 / 50 |
| grauto | 104 → 107 | 3 | 106 | 106 | 7 | 5 | 106 / 106 |
| jsmotors | 25 → 25 | 0 | 22 | 22 | 0 | 2 | 22 / 22 |
| jws | 8 → 8 | 0 | 8 | 0 | 0 | 1 | 0 / 0 |
| midwest | 4 → 4 | 0 | 4 | 4 | 0 | 1 | 4 / 4 |
| nsclassics | 16 → 16 | 0 | 16 | 16 | 0 | 5 | 16 / 16 |
| volo | 78 → 81 | 3 | 80 | 80 | 0 | 2 | 80 / 80 |

| Refreshed catalog | Complete | Pending | Blocked |
|---|---:|---:|---:|
| midwest / regional | 1 | 0 | 0 |
| classiccars / nationwide | 48 | 0 | 0 |
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
| admcars | 0 | 0 | 51 | active |
| autotrader | 1 | 18 | 0 | review |
| classiccars | 5105 | 0 | 50 | active |
| grauto | 0 | 1 | 106 | active |
| jsmotors | 0 | 3 | 22 | active |
| jws | 8 | 0 | 0 | active |
| midwest | 0 | 0 | 4 | active |
| nsclassics | 0 | 0 | 16 | active |
| volo | 0 | 1 | 80 | active |

ClassicCars detail enrichment remains a bounded batch; its pending/older details are not evidence of failed catalog discovery. Due counts include deferred retries and are unique tasks across scopes. Fresh completed tasks are within the configured cache window at comparison time. JWS is catalog-only; its retained matching cars remain explicitly sold unless the source actually reports a different status.

Catalogs were refreshed before separate detail passes. Detail passes used the existing freshness-aware cache, preserving actual response observation dates. After the bounded GR Auto pass, a targeted continuation selects only unblocked ads whose canonical detail observation predates this refresh. Already-fresh reopened queue entries remain a reconciliation follow-up. Attempt/cache counts stay separate from unique fresh detail ads.

500 Classic and Autotrader retain their prior review pauses without new requests. Disabled/restricted sources and provider permissions remain unchanged. Prior GR Auto and J & S missing detail pages retain their original evidence dates. Volo's former ad 19394 was verified as relisted under 19445 on November 4; its repaired outbound link and historical source dates are preserved, while the replacement remains in regular collection. The obsolete source ID's blocked task is retained as historical evidence rather than renewed as a separate active ad. New failures, if any, are counted above and retained in private run evidence. A missing page or catalog omission never establishes a sale/removal. The source-access audit remains dated evidence rather than a claim that every source was checked today. See [source access](../SOURCE_ACCESS.md), the [Volo repair receipt](volo-link-repair-2026-11-04.json) and [remaining improvements](../../FUTURE_IMPROVEMENTS.md).

## Approximate travel and location

The travel export supplies **1,671 ads with road estimates from 156 shared city routes**. Default about-four-hour discovery returns **497 ads**, using the selected origin and planning policy. Geographic generation does not renew seller observations. The retained US Midwest road graph is dated 2026-10-20T20:23:47Z; ferries remain excluded and estimates contain no live traffic. Census/ZIP references retain their original provenance. Unsupported destinations/origins remain explicit rather than receiving invented drive times.

## Verification and operation

Regional and nationwide catalogs were refreshed first with detail collection disabled for those passes. A separate 50-detail ClassicCars batch and bounded 100-detail dealer passes followed, with a canonical-freshness GR Auto continuation for remaining older eligible pages, honoring the configured cache freshness, source delays and provider budgets. Private database/environment backups were retained before and after refresh. No automatic worker was started; no ingest runs or leases remained active at final comparison.

Strict TypeScript, **305 unit tests in 29 files**, **20 desktop/mobile browser tests**, isolated release smoke, both static export paths, browser export checks, public travel/privacy/parity checks and the seven-report SBOM chain pass. The browser tests ran in a separate temporary copy; the passing run preserves the original test evidence and private workspace. [Public export verification](public-export-review-2026-11-26.json) checks exact canonical redaction, dates, catalog/detail hashes, obsolete chunk removal and configured credential exclusion. [Travel verification](travel-refresh-2026-11-26.json) records geographic coverage and reference checks.

The previously queued November 23 macOS check subsequently completed successfully; the [follow-up CI receipt](github-ci-nov23-followup-2026-11-26.json) records all six passing jobs.

Application code, collection settings, dependencies and lockfile are unchanged. Baselines, raw seller evidence, credentials, databases and recovery copies remain private and ignored. The public snapshot excludes the configured restricted observations.

[Aggregate refresh evidence](refresh-2026-11-26.json). Publication results are recorded separately in [delivery status](../DELIVERY.md).
