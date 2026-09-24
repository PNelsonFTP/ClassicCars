# Live data

## September 24 inventory refresh

The September 24 refresh retains **3,825 ads / 3,802 groups**, with **3,806 public ads / 3,789 public groups**. It added **541 ads**, recorded **229 numeric asking-price changes** (220 decreases, 9 increases), and refreshed details for **238 distinct ads**. 7 previously tracked ads are newly seller-reported sold.

See the [dated refresh report](docs/validation/refresh-2026-09-24-comparison.md) for catalog coverage, verification and remaining detail/source limitations. Older dated sections below are historical evidence.

## September 10, 2026 refresh

**3,197 retained ads / 3,175 groups; 3,178 public ads / 3,162 public groups.** The run added 58 ads and newly observed details for 1,045 distinct ads. [Comparison and limits](docs/validation/refresh-2026-09-10-comparison.md) · [aggregate evidence](docs/validation/refresh-2026-09-10-comparison.json) · [public export verification](docs/validation/public-export-review-2026-09-10.json).

The snapshot was generated at `2026-09-10T23:06:00.330Z`; each ad retains its original observation dates. All six active dealer detail queues are fresh and complete. ClassicCars has 870 newly observed details; its remaining work is paused at the configured 1,000-request daily limit. 500 Classic and Autotrader remain paused, and restricted or disabled sources remain uncollected. Source status changes are separate from freshness aging, and unseen ads are not assumed sold.

## Historical observations — September 8, 2026

> **September 8, 2026 final review refresh:** 3,139 retained ads / 3,139 groups, 3,120 public ads, 16 coordinate records and zero actual road routes. The final pass fetched 93 fresh catalog pages and exhausted the accessible configured queues. Details and real duplicate reconciliation remain open; 500 Classic and Autotrader stayed paused. See [current scan evidence](docs/validation/inventory-full-scan.json), [scope validation](docs/CONFIGURED_SCOPE_VALIDATION.md) and [handoff](HANDOFF.md). The earlier observations and counts below remain historical evidence.


Report generated 2026-09-08T03:17:11.110Z. Source observations occurred September 8, 2026 UTC (September 7 evening in Chicago); cached parsing preserves original times. Snapshot generation is not a new network observation.

The local database contains **1576 ads / 1576 current groups**. The real static snapshot contains **1557 ads / 1557 groups**; Autotrader's 19 observations stay local by default due to its redistribution terms. No repeated eligible strong grouping key was found, so no automatic group formed. Cross-listings have not been eliminated or proven absent, and no full human deduplication review was completed. The follow-up audit found 23,963 weak exact-title/model/year pairs (1,156 across sources); those similarities are not confirmed duplicates. See [the duplicate backlog](FUTURE_IMPROVEMENTS.md#the-cross-listing-problem-remains-open-in-the-real-inventory).

| Quick search (default preferences) | Connected ads | Snapshot ads |
|---|---:|---:|
| everyday | 0 | 0 |
| unknown-route | 1552 | 1533 |
| regional | 1560 | 1541 |
| nationwide | 33 | 32 |
| identity-review | 8 | 8 |
| specialty-review | 30 | 30 |
| auctions | 0 | 0 |

The strict everyday search has zero verified matches because no routing key was supplied. This is not evidence that no cars are nearby. Unknown-route review admits active/unknown/pending target ads and unknown sale types; regional relaxes preference filters. Nationwide still requires an established US vehicle location, active status and fixed/negotiable sale type, so it has fewer current matches than review.

Eight later Mustang ads were observed: seven selected-family seller claims and one Roush record outside the configured variant list. The default SVT/Cobra selection has one later 1998 seller claim. None has document-supported or user-reviewed factory authenticity, so enabling specialty does not silently promote them; use Specialty claim review. Thirty total ads have specialty claims needing review; eight have unresolved identity/year issues.

Home is a cached Wheaton city-center geocode (41.8646959,-88.1101709), observed 2026-09-08T02:51:00.850Z. Sixteen current vehicle records have coordinates; zero have verified driving routes. Twenty location records were processed in the bounded initial geocode run; later explicit detail evidence can invalidate earlier location coordinates. No straight-line distance is converted to driving hours.

The first research pass covered 25 ClassicCars pages and 22 dealer/Autotrader pages; 51 detail responses were initially investigated, with subsequent production checks and a North Shore endpoint validation. Most ads remain catalog-level observations. Some catalog refreshes previously replaced parser labels; detail-response counts are not an assertion that all records have complete specifications. See source reports and run history for exact scope.

No dedicated auction source was integrated. One ClassicCars ad is labeled auction, but its phase, deadline and current bid remain unverified; the default upcoming/live auction view therefore has zero matches. No authenticated Facebook collection occurred. Raw HTML, full identifiers, observation history, credentials, and personal workspaces stay in local ignored data. Public prose is abbreviated/paraphrased; seller claims remain unverified. Images remain source-hosted and may expire. This is not a complete regional or national inventory.

Refresh with the bounded collection command, explicit geocode/route commands and snapshot export described in README.
