# September 24, 2026 inventory refresh

Collection began at 2026-09-24T12:12:07.933030+00:00; final comparison checked at 2026-09-24T13:01:44.534645+00:00. Public export generated at 2026-09-24T13:01:36.197Z.

The September 24 refresh retains **3,825 ads / 3,802 groups**, with **3,806 public ads / 3,789 public groups**. It added **541 ads**, recorded **229 numeric asking-price changes** (220 decreases, 9 increases), and refreshed details for **238 distinct ads**. 7 previously tracked ads are newly seller-reported sold.

The baseline retained 3,284 ads / 3,262 groups, with 3,265 public ads / 3,249 public groups. No baseline ad IDs were removed. 3,029 distinct ads were observed during this window (including new ads); 7 existing asking prices became known and 8 became unknown. Source availability changed on 57 existing ads. Original observation timestamps determine freshness; generating an export does not refresh a listing.

## Collection coverage

94 catalog responses, 239 detail attempts and 238 successful detail checks; 2 catalog/detail failures and 0 cache hits during this window.

| Source | Retained before → after | Added | Observed | Fresh detail ads | Numeric ask changes | Catalog responses | Detail success / attempts |
|---|---:|---:|---:|---:|---:|---:|---:|
| 500classic | 3 → 3 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| admcars | 38 → 38 | 0 | 38 | 38 | 1 | 4 | 38 / 38 |
| autotrader | 19 → 19 | 0 | 0 | 0 | 0 | 0 | 0 / 0 |
| classiccars | 3076 → 3605 | 529 | 2833 | 50 | 214 | 74 | 50 / 50 |
| grauto | 50 → 57 | 7 | 57 | 57 | 12 | 5 | 57 / 57 |
| jsmotors | 24 → 24 | 0 | 22 | 22 | 0 | 2 | 22 / 23 |
| jws | 8 → 8 | 0 | 8 | 0 | 0 | 1 | 0 / 0 |
| midwest | 3 → 3 | 0 | 3 | 3 | 0 | 1 | 3 / 3 |
| nsclassics | 12 → 13 | 1 | 13 | 13 | 1 | 5 | 13 / 13 |
| volo | 51 → 55 | 4 | 55 | 55 | 1 | 2 | 55 / 55 |

| Catalog scope | Completed pages | Pending pages | Blocked pages |
|---|---:|---:|---:|
| midwest / regional | 1 | 0 | 0 |
| classiccars / nationwide | 49 | 0 | 0 |
| classiccars / regional | 25 | 0 | 0 |
| volo / regional | 2 | 0 | 0 |
| grauto / regional | 5 | 0 | 0 |
| admcars / regional | 4 | 0 | 0 |
| nsclassics / regional | 5 | 0 | 0 |
| jsmotors / regional | 2 | 0 | 0 |
| 500classic / regional | 0 | 1 | 0 |
| autotrader / regional | 0 | 1 | 0 |
| jws / regional | 1 | 0 | 0 |

## Remaining work and limits

The first J & S detail pass and first JWS catalog request encountered temporary DNS failures. Both were retried after cooldown; historical failed runs remain in the evidence. Paused 500 Classic and Autotrader entries reflect retained access failures, with no new requests to those sources.

One J & S task required targeted reopening because retry blocking counts lifetime attempts, including prior successes. The expired network-failed task was changed from blocked to pending through the operations store, preserving its existing attempt/error evidence until the retry succeeded. The final `--source=jsmotors --fresh --pages=0 --details=1` request completed successfully. Historical 404 tasks were not reopened. The remaining retry-design issue is recorded in [future improvements](../../FUTURE_IMPROVEMENTS.md).

| Source | Due detail tasks | Blocked detail tasks | Fresh completed tasks | Current health |
|---|---:|---:|---:|---|
| 500classic | 0 | 3 | 0 | review |
| admcars | 0 | 0 | 38 | active |
| autotrader | 1 | 18 | 0 | review |
| autotrader-classics | 0 | 0 | 0 | review |
| barrett | 0 | 0 | 0 | review |
| bat | 0 | 0 | 0 | review |
| camaroforum | 0 | 0 | 0 | review |
| cargurus | 0 | 0 | 0 | review |
| cars | 0 | 0 | 0 | review |
| carsbids | 0 | 0 | 0 | review |
| classiccars | 3555 | 0 | 50 | active |
| corvetteforum | 0 | 0 | 0 | review |
| craigslist | 0 | 0 | 0 | review |
| duffys | 0 | 0 | 0 | review |
| ebay | 0 | 0 | 0 | review |
| facebook | 0 | 0 | 0 | review |
| grauto | 0 | 0 | 57 | active |
| hemmings | 0 | 0 | 0 | review |
| indyauto | 0 | 0 | 0 | review |
| jsmotors | 0 | 2 | 22 | active |
| jws | 8 | 0 | 0 | active |
| mecum | 0 | 0 | 0 | review |
| midwest | 0 | 0 | 3 | active |
| mustangforum | 0 | 0 | 0 | review |
| nsclassics | 0 | 0 | 13 | active |
| volo | 0 | 0 | 55 | active |

- ClassicCars catalog traversal covers both configured regional and national searches. Detail enrichment is a separate, bounded 50-ad batch; the remaining due queue is not a new site failure. Queue counts are unique tasks across scopes.
- JWS remains catalog-only. Its matching retained ads are explicitly sold archive records; missing prices stay unknown. Its disabled detail endpoint is not retried.
- J & S Motors retains previously blocked 404 detail tasks. A missing page or absence from a catalog is not treated as proof of sale.
- 500 Classic and Autotrader remain paused. Disabled/restricted sources and missing provider credentials remain as documented in the [source-access audit](../SOURCE_ACCESS.md); this refresh does not redate that audit or establish new access.
- Ads and inferred groups are not verified unique physical cars. Cross-listing review remains open. No new routing credentials, provider permissions, or external notification setup were introduced.
- Source request intervals and daily quotas remain unchanged. Collection is finished with no active runs or leases; the automatic worker was not started.

## Validation and reproducibility

Regional collection used `npm run collect -- --fresh --pages=50000 --details=50`; nationwide catalog traversal used `npm run collect -- --source=classiccars --nationwide --fresh --pages=50000 --details=0`. Additional dealer-only detail batches used `--source=volo` / `--source=grauto` / `--source=jsmotors` with `--fresh --pages=0 --details=100`. JWS catalog collection was retried after a temporary DNS failure. Private backups were created before and after collection.

Both root and `/ClassicCars` exports were rebuilt and passed browser checks. The [public export review](public-export-review-2026-09-24.json) checks exact redaction against local data, fresh/stale projection, every detail chunk, positive/null prices, byte-identical built copies, obsolete files, and configured-secret exclusion. The [static browser receipt](static-review-2026-09-24.json) records root/subpath image, runtime and workspace-isolation checks. Application code, dependencies, configuration and lockfile are unchanged; earlier platform/SBOM evidence retains its original date.

[Aggregate collection evidence](refresh-2026-09-24.json). Public rows exclude the 19 retained Autotrader ads. Baseline/private seller payloads, cache evidence and backups remain local and ignored by Git.

## Publication

The [Pages deployment](https://github.com/PNelsonFTP/ClassicCars/actions/runs/36003058178) succeeded for `fc2de2f05fe8496249778f2b418ebd4db17005cd`, including type checks and all 268 tests in 27 files. The [live receipt](github-pages-2026-09-24.json) verifies 3,806 public ads, exact exported data hashes, search, lazy details, real images and desktop/mobile layouts. Later documentation-only commits record the receipt and do not change the deployed application/data.
