# Inventory refresh comparison

The September 10 refresh retained **3,197 ads / 3,175 groups**, including **58 new ads**. The public snapshot contains **3,178 ads / 3,162 groups**; Autotrader's 19 ads remain local. **1,045 distinct ads received fresh details**: all 175 retained ads from the six active dealers, plus 870 ClassicCars ads.

The run returned **160 fresh catalog pages with no cache hits**: the original 95-page search, 15 dealer recovery checks, and a renewed 50-page ClassicCars national cycle after DNS recovery. All accessible configured catalog queues were exhausted. Six dealers use the same broad catalog in regional and nationwide modes, so their catalogs were not duplicated merely to change the scope label.

ClassicCars stopped at the configured **1,000 request reservations per UTC day**. At the report time, its 3,000 tasks comprised 867 still-fresh completed tasks, 2,132 due tasks and one retry waiting until `2026-09-11T00:00:00.000Z`. Three ads with details observed earlier in this run are auctions whose one-hour detail freshness window has elapsed. Regional and nationwide memberships overlap; do not add their backlog counts. The background worker is off, so the retained retry does not run automatically in this session.

**59 existing numeric asking prices changed** (54 down, five up); two asks became known and two became unknown. Two ads are newly seller-reported sold. No ad was deleted because it disappeared from a catalog or a request failed. The 22 two-ad groups each have matching complete source identifiers and pass the current conflict gates; 16 pairs remain in the public export and six include an excluded Autotrader member. This supports grouping but does not authenticate paperwork or eliminate all cross-listings.

500 Classic and Autotrader remain paused with their prior observations retained. Disabled, restricted and credential-dependent sources remain uncollected. ClassicCars' timeout/DNS failures recovered through ordinary access and a fresh smoke check; its final cooldown is the local daily budget, not a new site access denial. Source restrictions and quotas were not bypassed. See [the implementation log](../../IMPLEMENTATION_LOG.md) for parser and provenance repairs, [scope evidence](../CONFIGURED_SCOPE_VALIDATION.md), and [export validation](public-export-review-2026-09-10.json).

The report generator below made no network requests or database writes; those counters describe report generation, not the preceding live collection. Comparison times, source observations and snapshot generation time remain separate.

Run window: 2026-09-10T20:09:42.325Z through 2026-09-10T23:05:55.710Z. Status: final-local-comparison.

| Measure | Before | After |
|---|---:|---:|
| Retained ads | 3139 | 3197 |
| Retained vehicle groups | 3139 | 3175 |
| Public ads under current settings | 3120 | 3178 |
| Public groups under current settings | 3120 | 3162 |

The comparison records 58 added ads, 3050 existing ads reobserved, and 1045 unique ads with newly observed details. Numeric asking prices changed on 59 existing ads; 2 asks became known and 2 became unknown. Source availability changed on 836 existing ads, including 2 newly seller-reported sold states.

| Source | Retained before → after | Added | Reobserved | Unique fresh details | Ask changes | Availability changes |
|---|---:|---:|---:|---:|---:|---:|
| 500classic | 3 → 3 | 0 | 0 | 0 | 0 | 0 |
| admcars | 38 → 38 | 0 | 38 | 38 | 0 | 0 |
| autotrader | 19 → 19 | 0 | 0 | 0 | 0 | 0 |
| autotrader-classics | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| barrett | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| bat | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| camaroforum | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| cargurus | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| cars | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| carsbids | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| classiccars | 2944 → 3000 | 56 | 2877 | 870 | 56 | 834 |
| corvetteforum | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| craigslist | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| duffys | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| ebay | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| facebook | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| grauto | 46 → 47 | 1 | 46 | 47 | 2 | 0 |
| hemmings | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| indyauto | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| jsmotors | 24 → 24 | 0 | 24 | 24 | 0 | 0 |
| jws | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| mecum | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| midwest | 3 → 3 | 0 | 3 | 3 | 0 | 0 |
| mustangforum | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| nsclassics | 12 → 12 | 0 | 12 | 12 | 1 | 0 |
| volo | 50 → 51 | 1 | 50 | 51 | 0 | 2 |

| Source | Catalog responses | Catalog request/parse failures | Detail attempts / successes / failures | Current health | Earlier failure followed by live validation |
|---|---:|---:|---:|---|---|
| 500classic | 0 | 0 | 0 / 0 / 0 | review | No |
| admcars | 8 | 0 | 39 / 38 / 1 | active | Yes |
| autotrader | 0 | 0 | 0 / 0 / 0 | review | No |
| autotrader-classics | 0 | 0 | 0 / 0 / 0 | review | No |
| barrett | 0 | 0 | 0 / 0 / 0 | review | No |
| bat | 0 | 0 | 0 / 0 / 0 | review | No |
| camaroforum | 0 | 0 | 0 / 0 / 0 | review | No |
| cargurus | 0 | 0 | 0 / 0 / 0 | review | No |
| cars | 0 | 0 | 0 / 0 / 0 | review | No |
| carsbids | 0 | 0 | 0 / 0 / 0 | review | No |
| classiccars | 125 | 0 | 875 / 870 / 5 | cooldown | No |
| corvetteforum | 0 | 0 | 0 / 0 / 0 | review | No |
| craigslist | 0 | 0 | 0 / 0 / 0 | review | No |
| duffys | 0 | 0 | 0 / 0 / 0 | review | No |
| ebay | 0 | 0 | 0 / 0 / 0 | review | No |
| facebook | 0 | 0 | 0 / 0 / 0 | review | No |
| grauto | 10 | 0 | 48 / 47 / 1 | active | Yes |
| hemmings | 0 | 0 | 0 / 0 / 0 | review | No |
| indyauto | 0 | 0 | 0 / 0 / 0 | review | No |
| jsmotors | 2 | 0 | 24 / 24 / 0 | active | No |
| jws | 0 | 0 | 0 / 0 / 0 | review | No |
| mecum | 0 | 0 | 0 / 0 / 0 | review | No |
| midwest | 1 | 0 | 3 / 3 / 0 | active | No |
| mustangforum | 0 | 0 | 0 / 0 / 0 | review | No |
| nsclassics | 12 | 0 | 14 / 13 / 1 | active | Yes |
| volo | 2 | 0 | 51 / 51 / 0 | active | No |

| Source | Enabled | Detail policy pause | Regional due / blocked | Nationwide due / blocked | Daily reservations / cap |
|---|---|---|---:|---:|---|
| 500classic | Yes | Yes | 0 / 3 | 0 / 0 | https://www.500classicauto.com: 0/1000 |
| admcars | Yes | No | 0 / 0 | 0 / 0 | https://www.admcars.com: 48/1000 |
| autotrader | Yes | No | 1 / 18 | 0 / 0 | https://www.autotrader.com: 0/1000 |
| autotrader-classics | No | No | 0 / 0 | 0 / 0 | https://classics.autotrader.com: 0/1000 |
| barrett | No | No | 0 / 0 | 0 / 0 | https://www.barrett-jackson.com: 0/1000 |
| bat | No | No | 0 / 0 | 0 / 0 | https://bringatrailer.com: 0/1000 |
| camaroforum | No | No | 0 / 0 | 0 / 0 | https://www.camaros.net: 0/1000 |
| cargurus | No | No | 0 / 0 | 0 / 0 | https://www.cargurus.com: 0/1000 |
| cars | No | No | 0 / 0 | 0 / 0 | https://www.cars.com: 0/1000 |
| carsbids | No | No | 0 / 0 | 0 / 0 | https://carsandbids.com: 0/1000 |
| classiccars | Yes | No | 542 / 0 | 2132 / 0 | https://classiccars.com: 1000/1000 |
| corvetteforum | No | No | 0 / 0 | 0 / 0 | https://www.corvetteforum.com: 0/1000 |
| craigslist | No | No | 0 / 0 | 0 / 0 | https://chicago.craigslist.org: 0/1000 |
| duffys | No | No | 0 / 0 | 0 / 0 | https://www.iowaclassiccars.com: 0/1000 |
| ebay | No | No | 0 / 0 | 0 / 0 | https://www.ebay.com: 0/1000 |
| facebook | No | No | 0 / 0 | 0 / 0 | https://www.facebook.com: 0/1000 |
| grauto | Yes | No | 0 / 0 | 0 / 0 | https://www.grautogallery.com: 59/1000 |
| hemmings | No | No | 0 / 0 | 0 / 0 | https://www.hemmings.com: 0/1000 |
| indyauto | No | No | 0 / 0 | 0 / 0 | https://www.indyauto.com: 0/1000 |
| jsmotors | Yes | No | 0 / 0 | 0 / 0 | https://jsmotors.com: 27/1000 |
| jws | No | No | 0 / 0 | 0 / 0 | https://www.jwsclassics.com: 0/1000 |
| mecum | No | No | 0 / 0 | 0 / 0 | https://www.mecum.com: 0/1000 |
| midwest | Yes | No | 0 / 0 | 0 / 0 | https://www.midwestmusclecars.com: 5/1000 |
| mustangforum | No | No | 0 / 0 | 0 / 0 | https://www.vintage-mustang.com: 0/1000 |
| nsclassics | Yes | No | 0 / 0 | 0 / 0 | https://www.nsclassics.com: 27/1000 |
| volo | Yes | No | 0 / 0 | 0 / 0 | https://www.volocars.com: 54/1000 |

## Reading the evidence

- Baseline public/group counts are recalculated with current source-exclusion settings; the baseline contains listings, not a historical settings snapshot.
- Added, reobserved and detail counts are distinct ad IDs. Scopes can contain the same detail task; do not sum regional and nationwide queue memberships as unique ads.
- Numeric asking-price changes compare existing ads only. Newly known and now-unknown asks are separate; price changes are not evidence of a sale.
- Observed sold/removed states are source claims. Absence from a catalog or this comparison never establishes a sale or removal.
- Freshness-only availability transitions are separate from changes in sourceAvailability. Export/report generation time is never counted as an observation.
- pagesFetched counts returned catalog responses, including cache reads; failedInventoryPages combines request and parse failures. The existing run counters do not support an exact separate catalog network-failure total.
- Detail attempts and successes are operation counts and can include cache reads/retries. Unique fresh-detail ads require lastDetailObservedAt to advance into this run window.
- Current-checkpoint completion counts retain the latest configured checkpoint cycle only; full window operation totals come from IngestRun records.
- A historical error followed by later live validation is retained as history, not labeled an ongoing source failure. Specific blocked tasks and the 500classic detail pause remain separate.
- Daily budgets count reserved request slots for the entire UTC day, across all scopes and operations sharing an origin; they are not this window's successful HTTP request count.
- Due counts follow normal detail-cache policy and task retry times. Enablement/health gates, policy pauses and per-origin budgets can still prevent work. Manual smoke and cap overrides are reported separately where persisted.
- Run after collection stops for final evidence. No private seller data, listing payloads, raw URLs, local evidence paths, error messages, home settings or credentials are emitted.

The companion JSON contains original health/run dates, caps, per-scope checkpoint counts and per-origin budget cooldowns. Source limitations remain in force; this report does not establish complete market coverage.

The run failure breakdown uses persisted typed health where available: ClassicCars recorded four network failures and one pre-request budget denial. A generic report-message classifier initially mislabeled the latter as layout; that derived label was corrected without changing source history or data.
