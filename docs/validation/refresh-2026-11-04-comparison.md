# November 4, 2026 inventory refresh

Collection began 2026-11-04T12:42:10.732Z; comparison 2026-11-04T13:30:47.638Z; public export 2026-11-04T13:30:44.579Z.

The November 4 refresh retains **4,961 ads / 4,927 groups**, including **4,942 public ads / 4,914 public groups**. It added **100 ads**, recorded **60 numeric asking-price changes** (42 decreases, 18 increases), and refreshed details for **302 distinct ads**. No previously tracked ads changed to seller-reported sold.

The baseline contained 4,861 retained ads / 4,831 groups and 4,842 public ads / 4,818 groups. 3,142 distinct ads were observed in this refresh window. No baseline IDs were removed. 4 existing asks became known and 5 became unknown. Projected availability changed on 25 existing ads; age-based stale status is separate from seller-reported sales. Ads/groups are not verified unique physical vehicles.

## Collection coverage

95 catalog responses; 302 successful detail checks / 303 attempts; 0 catalog failures; 1 detail failures; 0 cache hits. Fresh requests retain each source's configured delays, access settings and daily budgets.

| Source | Retained before → after | Added | Observed | Fresh detail ads | Ask changes | Catalog pages | Detail successes / attempts |
|---|---:|---:|---:|---:|---:|---:|---:|
| 500classic | 3 → 3 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| admcars | 47 → 47 | 0 | 47 | 47 | 0 | 4 | 47 / 47 |
| autotrader | 19 → 19 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| classiccars | 4576 → 4674 | 98 | 2882 | 50 | 59 | 75 | 50 / 50 |
| grauto | 92 → 93 | 1 | 92 | 92 | 1 | 5 | 92 / 92 |
| jsmotors | 25 → 25 | 0 | 22 | 22 | 0 | 2 | 22 / 22 |
| jws | 8 → 8 | 0 | 8 | 0 | 0 | 1 | 0 / 0 |
| midwest | 4 → 4 | 0 | 4 | 4 | 0 | 1 | 4 / 4 |
| nsclassics | 15 → 15 | 0 | 15 | 15 | 0 | 5 | 15 / 15 |
| volo | 72 → 73 | 1 | 72 | 72 | 0 | 2 | 72 / 73 |

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
| classiccars | 4624 | 0 | 50 | active |
| grauto | 0 | 1 | 92 | active |
| jsmotors | 0 | 3 | 22 | active |
| jws | 8 | 0 | 0 | active |
| midwest | 0 | 0 | 4 | active |
| nsclassics | 0 | 0 | 15 | active |
| volo | 0 | 1 | 72 | active |

ClassicCars detail enrichment remains a bounded batch; its pending/older details are not evidence of failed catalog discovery. Due counts include deferred retries and are unique tasks across scopes. Fresh completed tasks are within the configured cache window at comparison time. JWS is catalog-only; its retained matching cars remain explicitly sold unless the source actually reports a different status.

Catalogs were refreshed before separate detail passes. Detail passes used the existing freshness-aware cache, so old pages required live requests while any same-day responses retained their actual observation timestamps. Attempt/check counts remain separate from unique fresh detail ads.

500 Classic and Autotrader retain their prior review pauses without new requests. Disabled/restricted sources and provider permissions remain unchanged. Prior GR Auto and J & S missing detail pages retain their original evidence dates. Volo detail `volo:19394` returned HTTP 404 at `2026-11-04T12:58:31.166Z`; its single missing-page task is retained for review without an automatic retry or a sale inference. This is the only new request failure in this refresh. A missing page or catalog omission never establishes a sale/removal. The source-access audit remains dated evidence rather than a claim that every source was checked today. See [source access](../SOURCE_ACCESS.md) and [remaining improvements](../../FUTURE_IMPROVEMENTS.md).

## Approximate travel and location

The travel export supplies **1,548 ads with road estimates from 149 shared city routes**. Default about-four-hour discovery returns **489 ads**, using the selected origin and planning policy. Geographic generation does not renew seller observations. The retained US Midwest road graph is dated 2026-10-20T20:23:47Z; ferries remain excluded and estimates contain no live traffic. Census/ZIP references retain their original provenance. Unsupported destinations/origins remain explicit rather than receiving invented drive times.

## Verification and operation

Regional and nationwide catalogs were refreshed first with detail collection disabled for those passes. A separate 50-detail ClassicCars batch and bounded 100-detail dealer passes followed, honoring the configured cache freshness, source delays and provider budgets. Private database/environment backups were retained before and after refresh. No automatic worker was started; no ingest runs or leases remained active at final comparison.

Strict TypeScript, **305 unit tests in 29 files**, **20 desktop/mobile browser tests**, isolated release smoke, both static export paths, browser export checks, public travel/privacy/parity checks and the seven-report SBOM chain pass. The browser tests ran in a separate temporary copy; the passing run preserves the original test evidence and private workspace. [Public export verification](public-export-review-2026-11-04.json) checks exact canonical redaction, dates, catalog/detail hashes, obsolete chunk removal and configured credential exclusion. [Travel verification](travel-refresh-2026-11-04.json) records geographic coverage and reference checks.

Application code, collection settings, dependencies and lockfile are unchanged. Baselines, raw seller evidence, credentials, databases and recovery copies remain private and ignored. The public snapshot excludes the configured restricted observations.

[Aggregate refresh evidence](refresh-2026-11-04.json). Publication results are recorded separately in [delivery status](../DELIVERY.md).

## Publication

Published data commit [`7a1754f`](https://github.com/PNelsonFTP/ClassicCars/commit/7a1754fdf6dacae419c950d49520b5912bdd9103) passed the [Pages deployment](https://github.com/PNelsonFTP/ClassicCars/actions/runs/41839112539) and [all six CI jobs](github-ci-2026-11-04.json). [Live verification](github-pages-2026-11-04.json) matched all 108 public JSON files and the catalog consumed by the browser. Search, listing details, real images, city/ZIP lookup, travel filters and 1440/390/375px layouts passed without runtime errors, missing site assets or horizontal overflow. The closing documentation-only commit does not change published application/data bytes.
