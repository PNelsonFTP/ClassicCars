# Inventory refresh comparison

Run window: 2026-09-12T12:03:44.618Z through 2026-09-12T12:40:08.053Z. Status: final-local-comparison.

| Measure | Before | After |
|---|---:|---:|
| Retained ads | 3197 | 3276 |
| Retained vehicle groups | 3175 | 3254 |
| Public ads under current settings | 3178 | 3257 |
| Public groups under current settings | 3162 | 3241 |

The comparison records 79 added ads, 2995 existing ads reobserved, and 226 unique ads with newly observed details. Numeric asking prices changed on 47 existing ads; 6 asks became known and 1 became unknown. Source availability changed on 51 existing ads, including 1 newly seller-reported sold states.

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
| classiccars | 3000 → 3076 | 76 | 2822 | 50 | 46 | 50 |
| corvetteforum | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| craigslist | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| duffys | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| ebay | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| facebook | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| grauto | 47 → 50 | 3 | 47 | 50 | 1 | 0 |
| hemmings | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| indyauto | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| jsmotors | 24 → 24 | 0 | 22 | 22 | 0 | 0 |
| jws | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| mecum | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| midwest | 3 → 3 | 0 | 3 | 3 | 0 | 0 |
| mustangforum | 0 → 0 | 0 | 0 | 0 | 0 | 0 |
| nsclassics | 12 → 12 | 0 | 12 | 12 | 0 | 0 |
| volo | 51 → 51 | 0 | 51 | 51 | 0 | 1 |

| Source | Catalog responses | Catalog request/parse failures | Detail attempts / successes / failures | Current health | Earlier failure followed by live validation |
|---|---:|---:|---:|---|---|
| 500classic | 0 | 0 | 0 / 0 / 0 | review | No |
| admcars | 4 | 0 | 38 / 38 / 0 | active | Yes |
| autotrader | 0 | 0 | 0 / 0 / 0 | review | No |
| autotrader-classics | 0 | 0 | 0 / 0 / 0 | review | No |
| barrett | 0 | 0 | 0 / 0 / 0 | review | No |
| bat | 0 | 0 | 0 / 0 / 0 | review | No |
| camaroforum | 0 | 0 | 0 / 0 / 0 | review | No |
| cargurus | 0 | 0 | 0 / 0 / 0 | review | No |
| cars | 0 | 0 | 0 / 0 / 0 | review | No |
| carsbids | 0 | 0 | 0 / 0 / 0 | review | No |
| classiccars | 74 | 0 | 50 / 50 / 0 | active | Yes |
| corvetteforum | 0 | 0 | 0 / 0 / 0 | review | No |
| craigslist | 0 | 0 | 0 / 0 / 0 | review | No |
| duffys | 0 | 0 | 0 / 0 / 0 | review | No |
| ebay | 0 | 0 | 0 / 0 / 0 | review | No |
| facebook | 0 | 0 | 0 / 0 / 0 | review | No |
| grauto | 5 | 0 | 50 / 50 / 0 | active | Yes |
| hemmings | 0 | 0 | 0 / 0 / 0 | review | No |
| indyauto | 0 | 0 | 0 / 0 / 0 | review | No |
| jsmotors | 2 | 0 | 24 / 22 / 2 | active | Yes |
| jws | 0 | 0 | 0 / 0 / 0 | review | No |
| mecum | 0 | 0 | 0 / 0 / 0 | review | No |
| midwest | 1 | 0 | 3 / 3 / 0 | active | No |
| mustangforum | 0 | 0 | 0 / 0 / 0 | review | No |
| nsclassics | 6 | 0 | 12 / 12 / 0 | active | Yes |
| volo | 2 | 0 | 51 / 51 / 0 | active | No |

| Source | Enabled | Detail policy pause | Regional due / blocked | Nationwide due / blocked | Daily reservations / cap |
|---|---|---|---:|---:|---|
| 500classic | Yes | Yes | 0 / 3 | 0 / 0 | https://www.500classicauto.com: 0/1000 |
| admcars | Yes | No | 0 / 0 | 0 / 0 | https://www.admcars.com: 43/1000 |
| autotrader | Yes | No | 1 / 18 | 0 / 0 | https://www.autotrader.com: 0/1000 |
| autotrader-classics | No | No | 0 / 0 | 0 / 0 | https://classics.autotrader.com: 0/1000 |
| barrett | No | No | 0 / 0 | 0 / 0 | https://www.barrett-jackson.com: 0/1000 |
| bat | No | No | 0 / 0 | 0 / 0 | https://bringatrailer.com: 0/1000 |
| camaroforum | No | No | 0 / 0 | 0 / 0 | https://www.camaros.net: 0/1000 |
| cargurus | No | No | 0 / 0 | 0 / 0 | https://www.cargurus.com: 0/1000 |
| cars | No | No | 0 / 0 | 0 / 0 | https://www.cars.com: 0/1000 |
| carsbids | No | No | 0 / 0 | 0 / 0 | https://carsandbids.com: 0/1000 |
| classiccars | Yes | No | 1380 / 0 | 3026 / 0 | https://classiccars.com: 125/1000 |
| corvetteforum | No | No | 0 / 0 | 0 / 0 | https://www.corvetteforum.com: 0/1000 |
| craigslist | No | No | 0 / 0 | 0 / 0 | https://chicago.craigslist.org: 0/1000 |
| duffys | No | No | 0 / 0 | 0 / 0 | https://www.iowaclassiccars.com: 0/1000 |
| ebay | No | No | 0 / 0 | 0 / 0 | https://www.ebay.com: 0/1000 |
| facebook | No | No | 0 / 0 | 0 / 0 | https://www.facebook.com: 0/1000 |
| grauto | Yes | No | 0 / 0 | 0 / 0 | https://www.grautogallery.com: 56/1000 |
| hemmings | No | No | 0 / 0 | 0 / 0 | https://www.hemmings.com: 0/1000 |
| indyauto | No | No | 0 / 0 | 0 / 0 | https://www.indyauto.com: 0/1000 |
| jsmotors | Yes | No | 0 / 2 | 0 / 0 | https://jsmotors.com: 27/1000 |
| jws | No | No | 0 / 0 | 0 / 0 | https://www.jwsclassics.com: 0/1000 |
| mecum | No | No | 0 / 0 | 0 / 0 | https://www.mecum.com: 0/1000 |
| midwest | Yes | No | 0 / 0 | 0 / 0 | https://www.midwestmusclecars.com: 5/1000 |
| mustangforum | No | No | 0 / 0 | 0 / 0 | https://www.vintage-mustang.com: 0/1000 |
| nsclassics | Yes | No | 0 / 0 | 0 / 0 | https://www.nsclassics.com: 19/1000 |
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
