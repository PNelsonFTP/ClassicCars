# Location, drive-time and results review — October 21, 2026

The most useful next release is **“About four hours from home” with road-based city estimates, visible borderline matches and clear location confidence**. The current implementation makes the everyday search depend entirely on stored routes, while most ads lack a vehicle location and none has a route. This prevents useful results even though city-level estimates would satisfy the user's stated preference.

**Status:** This dated review records the pre-implementation baseline. The subsequently approved work is documented in the [implementation guide](TRAVEL_AND_RESULTS_IMPLEMENTATION.md). At the review stage, application code, private settings/database, inventory and deployment were not changed. Earlier cleanup/documentation changes remain uncommitted. The inventory is the October 19 export, not a new collection. See the [aggregate evidence](validation/location-review-2026-10-21.json); private analysis and source archives are under ignored `data/reports/location-review-2026-10-21/`.

## What the existing data supports

| Measure | Public inventory |
|---|---:|
| Ads | 4,559 |
| Vehicle city/state recorded | 876 (19.2%) |
| Vehicle location absent | 3,683 (80.8%) |
| Vehicle coordinates / straight-line distance | 16 (0.35%) |
| Stored driving routes | 0 |
| Advertised seller city/state usable as a lexical input | 4,552 |
| Distinct advertised city/state pairs before normalization | 523 |
| Distinct vehicle city/state pairs before normalization | 149 |
| Current everyday four-hour matches | 0 |

The configured starting city is Wheaton, Illinois, with coordinates already present locally. The ORS credential is absent. These are separate from the much larger missing-destination problem: providing a key alone will not fill the missing vehicle locations. A coordinate for an advertised city can support a planning estimate; it does not establish where an off-site car actually sits.

Source examples show why more detail downloading alone is insufficient: all 66 Volo and all 46 ADM ads have been detail-observed, yet none has a recorded vehicle location. J & S has 25 such ads and North Shore 14. GR Auto has vehicle cities for all 81 ads, and Midwest for all three. Much of the observed data lives only in `seller.location`; the common dealer builder intentionally initializes `vehicleLocation` to null. The right change is to represent both meanings, rather than silently turn the dealer office into a confirmed car location.

At the review clock, browser-equivalent freshness projection yields 1,277 active, 2,401 unknown, 841 stale and 40 sold ads. Current quick filters return 0 everyday ads, 3,305 unknown-route ads, 241 regional-scope ads and 661 nationwide ads. These are predicate/filter results, not market totals; location, status and model rules all affect them. Improving geography will still leave availability/detail quality work to do.

## Prioritized findings

| Priority | Finding and evidence | Recommended change | Effort |
|---|---|---|---|
| 1 | `shared/search.ts:117–164` requires a fresh route for every everyday match; `server/geography.ts:538–549` exits when the ORS key is absent. The real inventory has zero routes. | Make approximate road travel the shopping default. Keep an optional stricter location-evidence filter, with useful explicit unknown/borderline states. | Medium |
| 1 | 3,683 public ads lack a vehicle location even though 4,552 have advertised city/state. Dealer defaults in `server/ingest/adapters.ts:73–133` deliberately preserve the distinction. | Add a separate advertised destination and basis/confidence. Resolve city/ZIP/branch candidates locally; preserve actual-location evidence and off-site/conflicting states independently. | Medium |
| 1 | `shared/search.ts:117–125` checks route time/age and destination precision, but not the selected origin or route signature. A synthetic route from an unrelated city passes the everyday filter. | Bind travel eligibility to origin, destination, provider/graph version and routing options. Require that context in public exports, imports, saved searches and alerts. | Medium |
| 1 | Geocode/route jobs select ads in `server/geography.ts:272–367,538–626`. Existing caches already prevent many repeat network requests, but jobs still process ads individually. | Queue unique places, resolve/route once per origin/place/profile, then apply results across affected ads. Batch provider requests where capabilities permit. | Medium |
| 1 | Pages serves the committed snapshot without a worker; `Snapshot` has no explicit travel-origin metadata. Static mode labels the origin “Wheaton, Illinois” in `components/MuscleScout.tsx:506–510`. | Publish a versioned city travel table alongside inventory and expose its actual origin/date. Never relabel an old origin's estimates when a visitor changes home. | Medium |
| 2 | `shared/search.ts:168` defines regional matching by ingest `scope`, not distance from the selected origin. A geographically nearby ad collected nationally can fall outside that view. | Separate collection provenance from geographic eligibility. Use selected-origin travel/place data for nearby discovery; retain source scope only as provenance. | Small–medium |
| 2 | The detail trip link is already implemented, but only when `vehicleLocation` exists (`components/MuscleScout.tsx:2511–2521`). | Offer “Check trip to advertised city” on appropriate cards/details with an explicit basis; keep off-site uncertainty visible. This is an extension of an existing feature. | Small |
| 2 | 711 ads contain a vehicle city while their persisted unknown-reason text still says that vehicle location has not been established. | Derive display reasons from structured current state, and distinguish missing city, unresolved coordinates, missing route and uncertain vehicle location. | Small |
| 2 | Hard-coded four-hour counters/labels coexist with `Search.maxMinutes` (`components/MuscleScout.tsx:499–505`; `shared/schema.ts:210–215`). | Use one selected origin/time/context for filters, badges, counts, sorting and alerts; add 1/2/3/4/6-hour presets and near-limit toggle. | Medium |
| 2 | Detail tasks use lifetime attempts, including earlier successes, to decide when a later failure blocks (`server/ingest/operations.ts:664–708`). Most completed dealer tasks already have multiple attempts. | Track consecutive failures separately; add bounded audited transient recovery. This also protects location enrichment from being stranded by one later DNS failure. | Medium |

Effort is relative implementation scope, not a delivery estimate. The code references identify the reviewed implementation; they are not claims that fixes have been applied.

## Proposed shopping behavior

Use **“About 4 hours”** as the normal mode, with examples such as “About 3–4 hours · to advertised city” or “Near your 4-hour limit · confirm location.” These are interface-copy examples, not newly calculated trips. Let the user switch between typical traffic-free travel and a conservative planning buffer; do not imply live traffic where none exists.

Maintain two independent concepts:

- **Destination evidence:** seller-reported vehicle city, advertised city only, reviewed dealer branch, explicit off-site/unresolved, conflicting, or unknown.
- **Travel evidence:** routed city-to-city baseline, reviewed reusable city band, stale estimate, or no estimate. Store the method/provider and input context separately from the label.

A useful location can remain approximate. A city or ZIP representative point is sufficient for planning a car-shopping trip. It must stay labeled at that precision; seller-city data is not an exact vehicle address. For ads explicitly saying the car is elsewhere, do not put the dealer's trip time into the ordinary “within four hours” result. The dealer-city trip can be shown separately as reference while the actual destination remains unresolved.

For a chosen limit `T`, classify a planning interval `[low, high]`:

| Classification | Rule | Display/filter behavior |
|---|---|---|
| Likely within | `high <= T` | Include in normal approximate results. |
| Near the limit | `low <= T < high` | Show in a clearly marked borderline section; enabled by default for approximate discovery. |
| Likely outside | `low > T` | Hide unless “show farther cars” is enabled. |
| Unresolved | No defensible destination or road estimate | Keep in a separate visible review path; do not invent a duration. |

A first planning margin could use 15–30 minutes and a modest duration-dependent buffer, but those are hypotheses to calibrate against representative trips, not statistical confidence bounds. Round presentation to useful bands or 15/30-minute increments. Do not round before threshold classification. Preserve a consistent rule across cards, counts, API pages, saved searches and alerts.

Avoid a universal straight-line-miles-to-hours conversion. Lake Michigan, road crossings, interstates and Chicago congestion make that unreliable. A straight-line measure can help queue distant candidates or provide a clearly labeled spatial sort; it must not become a driving estimate. Boundary candidates especially need actual road connectivity.

## Offline city resolution: measured feasibility

I downloaded the official [2026 Census Gazetteer places and county-subdivision datasets](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2026.html): 32,363 place rows and 36,381 subdivision rows, approximately 2.7 MB compressed together. They supply identifiers/names and representative coordinates; they are geographic reference points, not dealership/car coordinates or a road graph.

A read-only experiment constrained matches by state, normalized punctuation/case, removed only Census legal suffixes from dataset labels, and added a same-entity charter-township alias. Multiple matching GEOIDs remained ambiguous. Natural city names such as “Traverse City” were preserved. No fuzzy correction, network geocoding or route request was used.

| Input basis | One place candidate | One subdivision candidate | Ambiguous | Unmatched | Missing city/state |
|---|---:|---:|---:|---:|---:|
| Vehicle city | 833 | 25 | 3 | 15 | 3,683 |
| Advertised city | 4,265 | 106 | 5 | 176 | 7 |

This gives **4,371 advertised-city candidate matches (95.9% of all ads)** across 480 distinct normalized keys. It gives candidates for 858 of 876 currently recorded vehicle-city ads. These are lexical feasibility results, **not validated geocodes, actual vehicle confirmations, route coverage or proof that any car is within four hours**. Place-versus-subdivision precedence, ambiguous county names, rural extents and routing snap distances need acceptance checks.

Unmatched examples include “Ft Worth,” “New Braundfels,” “Colombus,” “Pittsbirgh,” postal/neighborhood names, and place-name aliases. Add a small reviewed alias table with raw spelling, canonical ID, state and evidence; keep uncertain typo matches for review rather than silently picking the nearest name. Preserve natural city-name words when stripping legal suffixes. Add ZIP support carefully: a ZCTA representative point is a geographic approximation, not a universal USPS city/ZIP identity mapping.

Prefer the local gazetteer/branch registry for repeated city resolution. The current public Nominatim service has restrictive capacity, periodic/bulk and caching requirements; it should not become a recurring inventory-wide lookup service. Its [usage policy](https://operations.osmfoundation.org/policies/nominatim/) permits limited controlled use but discourages bulk work and requires identifying clients and caching. A larger service workload needs an appropriate hosted or self-managed service. Existing 15-second spacing does not by itself establish suitability for every bulk workflow.

## Getting approximate road times

The recommended architecture is to calculate a **traffic-free road baseline to each distinct supported place**, retain the estimate and its context, then present a coarse band. This avoids per-ad routing and does not require publishing route geometry or an exact street address.

| Option | Fit here | Conditions/tradeoffs |
|---|---|---|
| Existing ORS adapter, extended to place jobs | Smallest code change for the first working route-backed version. | A real configured key is required. Deduplicate destinations; use directions where required options cannot be preserved in matrix mode. Verify response/usage/publication requirements for the chosen account. |
| Approved matrix provider | Efficient one-origin-to-many-place baseline. | Both [ORS matrix](https://giscience.github.io/openrouteservice/api-reference/endpoints/matrix/) and [OSRM Table](https://project-osrm.org/docs/v26.6.1/http) expose multi-destination durations. Respect element/request budgets, partial/null results and supported ferry/border options. |
| Local OSRM during enrichment/publishing | Avoids a user-held hosted routing key while keeping the site static. | [Official setup](https://github.com/Project-OSRM/osrm-backend/blob/master/README.md) requires a road extract and preprocessing/runtime resources. A regional graph must include necessary highway detours; a circle clipped around home is insufficient. Treat this as optional operations work, not a mandatory website container. |
| Reachability map/isochrone | Good later visualization of approximate 2/4/6-hour areas. | [ORS isochrones](https://giscience.github.io/openrouteservice/api-reference/endpoints/isochrones/) return road-reachability polygons. Verify that the selected deployment/account supports a full four-hour contour with required options. Do not assume every hosted service does. |

Disable OSRM's `fallback_speed` for travel eligibility: the [Table API](https://project-osrm.org/docs/v26.6.1/http) explicitly makes that fallback a straight-line-derived duration when routing fails. Preserve null/unreachable results instead. OSRM's [default car profile](https://github.com/Project-OSRM/osrm-backend/blob/master/profiles/car.lua) supports a ferry exclusion class, but deployed profiles/options still need verification; do not silently drop the current app's ferry/border policy when changing providers.

Do not make the [OSRM demo server](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server) the production data pipeline. Its documented restrictions and lack of service guarantees make an approved/self-hosted deployment the sound option. External directions links remain helpful: [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) need no API key for opening a trip, but they are a user handoff rather than a source to scrape durations from.

As observed during this review, the [ORS website](https://openrouteservice.org/) shows a maintenance notice while stating that APIs remain available. Older restrictions/terms URLs did not resolve in this research. Do not interpret the website issue as proof that routing APIs are blocked, and do not promise current plan limits or redistribution rights without the account-specific check.

## Preserve GitHub Pages support

Publish a compact, versioned travel artifact next to the public catalog. For the first release, generate it for the configured coarse origin **Wheaton, IL** and resolved destination IDs. The browser can filter and sort it immediately without a running API, exposed secret or live routing call. Existing backend/CLI enrichment can produce the artifact before deployment.

The artifact needs an origin ID/label/precision, destination ID/point, road-profile/options signature, graph/provider version, computation date, baseline/range and location-basis mapping. Keep a personal street origin out of public exports. A cache key must bind all relevant inputs; two ads in the same resolved place can share travel evidence without being grouped as the same vehicle.

A visitor choosing a different starting city must receive matching precomputed data or use a configured backend for that origin. Otherwise clearly mark it unsupported and retain the original context; never continue displaying Wheaton's estimates under a different home label. Multiple precomputed origins can be added later. Arbitrary-origin routing is not supplied by a single-origin static table.

Separate ad freshness, vehicle-location evidence freshness and road-graph estimate age. An unchanged city may share a road baseline across many new ads. Do not refresh a seller sighting merely because a route was reused. Stale road data may be labeled for planning under a deliberate policy; it must not silently become fresh strict evidence.

## Other improvements worth making

| Order | Improvement | Practical result |
|---|---|---|
| 1 | Separate “recently advertised” from “seller confirmed active”; provide explicit stale/unknown switches and exclusion reasons. | Location improvements do not leave useful candidate ads hidden by unexplained status filters. Sold/removed remain excluded from ordinary shopping. |
| 2 | Prioritize detail enrichment by potential nearby relevance, favorites, changed catalog facts and missing location/price, with fairness for the rest. | The bounded 50-detail ClassicCars pass becomes more useful for actual shopping than a largely age/ID-driven backlog. Source limits remain in effect. |
| 3 | Add quality counters: vehicle-city coverage, advertised-city estimate coverage, ambiguous cities, nearby candidates waiting on detail and provider failures. | Show whether an empty result means no matches, unresolved data or an unavailable service. Report ad and group counts distinctly. |
| 4 | Improve cross-listing review using normalized stock, reviewed seller aliases and corroborating identifiers; keep conflicts visible. | Reduce repeated shopping results while retaining each source's price and evidence. Sharing a city/time must never be sufficient to merge cars. |
| 5 | Capture “call for price,” price history and source freshness distinctly; surface saved-search price drops and sold changes. | Better comparison without inventing an asking price or claiming a failed page proves a sale. |
| 6 | Make home/travel settings a small city/ZIP form with origin confirmation and time presets; retain advanced JSON separately. | The user can change practical preferences without editing a full settings object. |
| 7 | Distinguish map symbols for reported vehicle cities versus advertised cities and show the active origin. | Approximate locations become useful without appearing to be exact car pins. Add road reachability shading only after validating its semantics. |
| 8 | Automate the verified publish path after authorized data refresh, with an explicit origin/travel artifact check and public-data scan. | A repository push/manual Pages dispatch cannot accidentally ship old travel evidence with new labels. No schedule or automatic deployment was installed by this review. |
| 9 | Address the existing SBOM artifact-manifest chain and define backup/evidence rotation. | Keep operational maintenance predictable after the approved cleanup. Preserve all retained recovery states until a separate retention policy is chosen. |

Existing functionality should be extended where it already exists: details already link to trip directions, duplicate review and alerts already have implementations, and geographic cache keys already deduplicate many provider lookups. The proposed changes target data coverage, semantics and usability rather than replacing those systems wholesale.

## Suggested delivery sequence and acceptance

1. **Coverage and correctness:** introduce location basis/canonical place IDs; bind travel to the active origin; offline-resolve current vehicle and advertised cities; add reviewed aliases and structured failure reasons. Keep raw source wording and reviewed corrections.
2. **Useful four-hour results on Pages:** implement provider-backed place routing/caching, calibrated rounded bands and borderline handling; publish the coarse-origin travel artifact and integrate it into shared search, cards, counts, sorting, saved searches and alerts. Include useful advertised-city estimates with an explicit label and an optional stricter location mode.
3. **Shopping and maintenance:** improve nearby detail priority/status controls, origin form, map distinctions, grouping review and release checks; add isochrones or additional origins only after baseline coverage works.

Before shipping, verify:

- Wrong-origin, changed-origin and changed-options routes cannot qualify; a previously imported mismatched route is reviewed/recomputed.
- Same-city ads share a route lookup while retaining separate stock/price/location evidence.
- “Traverse City,” township aliases, duplicate city names, misspellings and neighborhood/ZIP cases do not get silently mislocated.
- A road route around Lake Michigan stays a road route, with ferries handled according to the selected policy; no straight-line fallback qualifies.
- City/ZIP uncertainty, 3h59/4h01 threshold cases, boundary bands, unreachable roads and stale estimates have consistent classification.
- Explicitly off-site vehicles do not inherit a dealer's eligibility; an advertised-city estimate is visible with its actual basis.
- Static root and `/ClassicCars` builds retain matching travel origin/version; arbitrary new origins do not reuse old estimates.
- Geography changes do not manufacture new-car alerts or overwrite notes/reviewed locations; API, browser, compact catalog and alert results remain in parity.
- Public travel data contains no secret/provider key or private home address and complies with the chosen data/service terms.

No road duration or coverage gain is claimed as implemented. The next implementation should be judged by useful, explainable approximate trip coverage and correct boundary/location handling, rather than minute-level accuracy.
