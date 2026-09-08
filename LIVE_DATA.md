# Live data

Report generated 2026-09-08T03:17:11.110Z. Source observations occurred September 8, 2026 UTC (September 7 evening in Chicago); cached parsing preserves original times. Snapshot generation is not a new network observation.

The local database contains **1576 ads / 1576 current groups**. The real static snapshot contains **1557 ads / 1557 groups**; Autotrader's 19 observations stay local by default due to its redistribution terms. No repeated eligible strong grouping key was found, so no automatic group formed. Cross-listings have not been eliminated or proven absent, and no full human deduplication review was completed. The follow-up audit found 23,963 weak exact-title/model/year pairs (1,156 across sources); those similarities are not confirmed duplicates. See [the duplicate backlog](FUTURE_IMPROVEMENTS.md#the-cross-listing-problem-remains-open).

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
