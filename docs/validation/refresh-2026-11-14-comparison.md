# November 14, 2026 inventory refresh

Collection began 2026-11-14T13:50:42.140Z; comparison 2026-11-14T14:40:39.103Z; public export 2026-11-14T14:40:34.671Z.

The November 14 refresh retains **5,211 ads / 5,175 groups**, including **5,192 public ads / 5,162 public groups**. It added **192 ads**, recorded **275 numeric asking-price changes** (139 decreases, 136 increases), and refreshed details for **313 distinct ads**. **2 previously tracked ads** are newly seller-reported sold.

The baseline contained 5,019 retained ads / 4,985 groups and 5,000 public ads / 4,972 groups. 3,166 distinct ads were observed in this refresh window. No baseline IDs were removed. 7 existing asks became known and 3 became unknown. Projected availability changed on 35 existing ads; age-based stale status is separate from seller-reported sales. Ads/groups are not verified unique physical vehicles.

## Collection coverage

96 catalog responses; 313 successful detail checks / 313 attempts; 0 catalog failures; 0 detail failures; 0 cache hits. Fresh requests retain each source's configured delays, access settings and daily budgets.

| Source | Retained before → after | Added | Observed | Fresh detail ads | Ask changes | Catalog pages | Detail successes / attempts |
|---|---:|---:|---:|---:|---:|---:|---:|
| 500classic | 3 → 3 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| admcars | 47 → 49 | 2 | 49 | 49 | 0 | 4 | 49 / 49 |
| autotrader | 19 → 19 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| classiccars | 4728 → 4913 | 185 | 2895 | 50 | 266 | 75 | 50 / 50 |
| grauto | 97 → 99 | 2 | 98 | 98 | 9 | 6 | 98 / 98 |
| jsmotors | 25 → 25 | 0 | 22 | 22 | 0 | 2 | 22 / 22 |
| jws | 8 → 8 | 0 | 8 | 0 | 0 | 1 | 0 / 0 |
| midwest | 4 → 4 | 0 | 4 | 4 | 0 | 1 | 4 / 4 |
| nsclassics | 15 → 15 | 0 | 15 | 15 | 0 | 5 | 15 / 15 |
| volo | 73 → 76 | 3 | 75 | 75 | 0 | 2 | 75 / 75 |

| Refreshed catalog | Complete | Pending | Blocked |
|---|---:|---:|---:|
| midwest / regional | 1 | 0 | 0 |
| classiccars / nationwide | 50 | 0 | 0 |
| classiccars / regional | 25 | 0 | 0 |
| volo / regional | 2 | 0 | 0 |
| grauto / regional | 6 | 0 | 0 |
| admcars / regional | 4 | 0 | 0 |
| nsclassics / regional | 5 | 0 | 0 |
| jsmotors / regional | 2 | 0 | 0 |
| jws / regional | 1 | 0 | 0 |

## Remaining detail work and access limits

| Source | Due detail tasks | Blocked detail tasks | Fresh completed tasks | Current health |
|---|---:|---:|---:|---|
| 500classic | 0 | 3 | 0 | review |
| admcars | 0 | 0 | 49 | active |
| autotrader | 1 | 18 | 0 | review |
| classiccars | 4863 | 0 | 50 | active |
| grauto | 0 | 1 | 98 | active |
| jsmotors | 0 | 3 | 22 | active |
| jws | 8 | 0 | 0 | active |
| midwest | 0 | 0 | 4 | active |
| nsclassics | 0 | 0 | 15 | active |
| volo | 0 | 1 | 75 | active |

ClassicCars detail enrichment remains a bounded batch; its pending/older details are not evidence of failed catalog discovery. Due counts include deferred retries and are unique tasks across scopes. Fresh completed tasks are within the configured cache window at comparison time. JWS is catalog-only; its retained matching cars remain explicitly sold unless the source actually reports a different status.

Catalogs were refreshed before separate detail passes. Detail passes used the existing freshness-aware cache, so old pages required live requests while any same-day responses retained their actual observation timestamps. Attempt/check counts remain separate from unique fresh detail ads.

500 Classic and Autotrader retain their prior review pauses without new requests. Disabled/restricted sources and provider permissions remain unchanged. Prior GR Auto and J & S missing detail pages retain their original evidence dates. Volo's former ad 19394 was verified as relisted under 19445 on November 4; its repaired outbound link and historical source dates are preserved, while the replacement remains in regular collection. The obsolete source ID's blocked task is retained as historical evidence rather than renewed as a separate active ad. New failures, if any, are counted above and retained in private run evidence. A missing page or catalog omission never establishes a sale/removal. The source-access audit remains dated evidence rather than a claim that every source was checked today. See [source access](../SOURCE_ACCESS.md), the [Volo repair receipt](volo-link-repair-2026-11-04.json) and [remaining improvements](../../FUTURE_IMPROVEMENTS.md).

## Approximate travel and location

The travel export supplies **1,602 ads with road estimates from 150 shared city routes**. Default about-four-hour discovery returns **486 ads**, using the selected origin and planning policy. Geographic generation does not renew seller observations. The retained US Midwest road graph is dated 2026-10-20T20:23:47Z; ferries remain excluded and estimates contain no live traffic. Census/ZIP references retain their original provenance. Unsupported destinations/origins remain explicit rather than receiving invented drive times.

## Verification and operation

Regional and nationwide catalogs were refreshed first with detail collection disabled for those passes. A separate 50-detail ClassicCars batch and bounded 100-detail dealer passes followed, honoring the configured cache freshness, source delays and provider budgets. Private database/environment backups were retained before and after refresh. No automatic worker was started; no ingest runs or leases remained active at final comparison.

Strict TypeScript, **305 unit tests in 29 files**, **20 desktop/mobile browser tests**, isolated release smoke, both static export paths, browser export checks, public travel/privacy/parity checks and the seven-report SBOM chain pass. The browser tests ran in a separate temporary copy; the passing run preserves the original test evidence and private workspace. [Public export verification](public-export-review-2026-11-14.json) checks exact canonical redaction, dates, catalog/detail hashes, obsolete chunk removal and configured credential exclusion. [Travel verification](travel-refresh-2026-11-14.json) records geographic coverage and reference checks.

The previously queued macOS check for the November 4 Volo link correction subsequently completed successfully; the [follow-up CI receipt](github-ci-volo-link-followup-2026-11-06.json) records all six passing jobs.

Application code, collection settings, dependencies and lockfile are unchanged. Baselines, raw seller evidence, credentials, databases and recovery copies remain private and ignored. The public snapshot excludes the configured restricted observations.

[Aggregate refresh evidence](refresh-2026-11-14.json). Publication results are recorded separately in [delivery status](../DELIVERY.md).
