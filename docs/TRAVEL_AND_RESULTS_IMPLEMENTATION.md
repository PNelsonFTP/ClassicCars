# Location and results improvements — October 21, 2026

This release implements the approved [location/results review](LOCATION_AND_RESULTS_REVIEW_2026-10-21.md). The priority is practical **“About four hours from home”** discovery, using a real road baseline and city-level destinations. The website remains a Next.js static export that runs on GitHub Pages without a backend, Docker container, routing key or live routing requests.

Inventory observations remain dated October 19. Generating geographic reference data, routes or a new public export does **not** renew a seller sighting, establish availability or verify a vehicle's physical location. The [verification record](validation/travel-2026-10-21.json) contains the executed evidence: **1,484 estimated ads from 147 shared city routes**, **488 nearby ads / 483 groups**, including **157 near-limit ads**. All **305 unit tests**, **20 desktop/mobile tests**, both static exports, release smoke, public-data checks and the seven-report SBOM chain pass.

## What changed

| Area | Implementation |
|---|---|
| Practical travel | `shared/travel.ts` applies a traffic-free road baseline with a planning interval. The typical range subtracts `max(15 minutes, 20%)` and adds `max(15 minutes, 10%)` to the baseline; extra buffer instead starts at the baseline and adds `max(30 minutes, 20%)`. The wider lower allowance reflects model variability, including the stock OSRM car profile's 0.8 tagged-speed reduction. These are planning heuristics, not statistical confidence bounds or traffic predictions. |
| Four-hour decisions | Compare unrounded `[low, high]` to the chosen time limit. `high <= limit` is within, `low <= limit < high` is near the limit, and `low > limit` is outside. Near-limit inclusion defaults on; display rounds to useful 15/30-minute bands. |
| Location evidence | Keep reported/reviewed vehicle city, advertised city, explicit off-site, ambiguous and unknown states distinct. Advertised-city estimates default on with a confirmation note. Strict mode requires a reported/reviewed vehicle destination and uses the baseline cutoff without the planning buffer. It still represents a city, not an exact car address. |
| Durable disclosure | Fresh detail parsing records structured off-site/reported-location disclosure. Catalog refreshes preserve it. Old explicit off-site flags/reason text remain a conservative fallback; a reviewed actual-location correction can resolve it. |
| Origin correctness | Each road record binds origin city/key/point, destination ID/point, car profile, graph version/date, computation time and snap distances. Artifact validation rejects mismatched or duplicate context. Legacy per-ad routes require matching route context and destination coordinates; older context-free routes need renewal. |
| Offline resolution | State-qualified Census places/subdivisions supply representative points. Prefer a unique incorporated/place candidate; ambiguous subdivisions remain unresolved. Dataset legal suffix normalization preserves natural names such as Traverse City. Explicit reviewed aliases cover a small list of observed spelling/abbreviation issues. |
| Home form | City/state or ZIP lookup loads only the needed state catalog. ZIPs select cities; they do not imply exact addresses. Home/travel preferences persist in the deployment/mode/backend-scoped browser workspace. Unsupported origins show a clear warning and never borrow another city's routes. |
| Static support | `public/data/travel.json` is also embedded in the full and compact catalogs. The browser reprojects location/travel and inventory freshness at its own clock. Full details retain the same context. Public artifacts contain coarse origins only. |
| Regional discovery | The regional preset starts at six hours or a larger previous limit; subsequent time-control changes are honored consistently. Geography uses the selected origin rather than a collector's `scope` provenance. Ordinary shopping excludes sold/removed observations by default. Nationwide uses usable US vehicle/advertised destinations without the time cap. |
| Results and maps | Dynamic limits/counts, road-estimate sorting, source-location notes, trip links, coverage counters, and explicit unknown/borderline states. Gold map groups include advertised cities; rust groups represent reported vehicle cities; green marks the active origin. Map selection keeps the original listing. No circular driving boundary is drawn. |
| Availability and prices | Recent/active, seller-reported active and older-observation presets. An absent ask reads “Price not stated”; explicit seller requests read “Call for price.” Numeric asks and bids remain separate, as do each source's histories. |
| Detail queue | Consecutive failures are separate from lifetime attempts and reset after success. Reviewed transient retries retain error/history and server cooldowns. Missing/access/policy/layout problems still require the appropriate review. Catalog fact changes reopen completed details; mere new observation timestamps do not. |
| Detail priority | Favorites, changed catalog facts, plausible nearby trips, missing location and missing price receive priority. Every fourth choice comes from the oldest due work to prevent starvation. Existing source/request limits still apply. |
| Duplicate review | Automatic strong stock keys now use the same conservative stock/seller normalization as ranked review. Leading zeros and meaningful slash/dot suffixes survive; raw source values and identifier conflicts remain visible. Existing reviewed aliases, merge/undo and per-ad histories continue. Shared travel never groups cars. |
| Alerts | A changed search or travel artifact establishes a quiet baseline. Expanded geographic coverage cannot masquerade as newly advertised cars. Existing per-source price/availability changes and optional crosspost notifications remain supported after the baseline. |
| Publication | `verify:travel` validates origin/context/age, catalog parity, chunk hashes, reference catalogs and public-data privacy. Pages checks it before and after build. `publish:prepare` runs the full local verification path and writes a private receipt; it never commits, pushes or deploys. |
| SBOM / retention | `sbom:refresh` regenerates the graph, adds target/bundled artifacts to the manifest, then validates the chain. An existing unlisted artifact now fails validation. `backup:retention` proposes retention/duplicate candidates but has no deletion mode; existing recovery states and Low-confidence cleanup files stay protected. |

## Geographic and routing data

Place reference comes from the [2026 US Census Gazetteer](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2026.html). ZIP reference comes from [GeoNames](https://download.geonames.org/export/zip/readme.txt), under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). `public/places/manifest.json` records input hashes, source URLs, attribution and the reviewed alias list. The state files are lazy-loaded; they are not fetched as a national payload on page load.

Roads come from the [Geofabrik US Midwest extract](https://download.geofabrik.de/north-america/us-midwest.html), © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), under [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Native [OSRM](https://github.com/Project-OSRM/osrm-backend) calculates road durations; its car profile excludes ferries for these requests. The US graph avoids Canadian transit. Null/unreachable destinations remain unresolved. No straight-line fallback speed or universal miles-to-hours conversion is used.

The graph is regional. Destinations outside its coverage can have a resolved city and no trip estimate. The publisher can generate additional coarse origins within the graph. A static site cannot compute arbitrary new origins from a single-origin table. No live congestion, weather, stops, road closures or exact driveway locations are modeled. The stock OSRM car profile can be conservative: its [tagged-speed reduction](https://github.com/Project-OSRM/osrm-backend/blob/v26.10.0/profiles/car.lua) is 0.8. The displayed planning range allows for that model variance; it is not an independently calibrated prediction.

The full Midwest Docker extraction exceeded the existing roughly 8 GB Docker allocation. Native OSRM 26.10.0 and osmium-tool 1.19.1 were installed through Homebrew; Docker memory settings were not changed. Native preprocessing uses four threads and substantial host memory/disk. A road-only filter retains highways, routing restrictions and their referenced objects before extraction. This build's filter ran as osmium 1.15.0 in a transient Debian container; the installed native 1.19.1 utility is used by the repeatable command going forward. The input header/hash and original extract hash preserve that distinction. The retained ignored road cache occupies about 22 GiB; preprocessing peaked around 20 GiB RAM, so allow at least 24 GiB RAM and 30 GiB disk for a full rebuild. These tools and ignored road files are **publication tooling**, not website runtime dependencies. Their versions/input hashes are recorded in the graph manifest; npm SBOMs do not cover these separately installed programs.

## Repeatable operation

The committed reference/travel artifacts suffice for ordinary website builds. Rebuild reference files only when updating those datasets:

```sh
npm run places:download
npm run places:build
```

For a new road graph, install native OSRM and osmium-tool (on macOS: `brew install osrm-backend osmium-tool`) and allow sufficient memory/disk. The preparation command downloads the source only if absent; `--refresh` deliberately renews it. A nonstandard OSRM installation can pass its matching `--profile=/path/to/car.lua`.

```sh
npm run roads:prepare                  # filter, extract, partition, customize, manifest
npm run roads:serve                    # local router at 127.0.0.1:5015; leave running
```

In another terminal:

```sh
npm run travel:build -- --origin=Wheaton,IL
npm run roads:verify                   # representative trips and a real Lake Michigan land detour
# Optional: add a genuinely generated table for another city in the graph:
# npm run travel:build -- --origin=Madison,WI
npm run export:snapshot
npm run verify:travel
npm run sbom:refresh
npm run publish:prepare
```

`travel:build -- --offline` reuses already calculated matching-context routes and refreshes place membership without any routing request. It preserves original route/graph dates; it does not make stale evidence fresh. A normal inventory refresh can export with the existing atlas; new cities lacking routes remain unknown until routed. Stop the local router with Ctrl+C when generation finishes.

Back up the private database/environment before migrations or collection. This implementation adds JSON fields and public derived artifacts; it does not require a database migration. Geographic generation itself does not alter canonical listing payloads. Never publish `.env`, `data/`, `backups/`, private evidence or a personal street origin.

## Acceptance and remaining limits

Verification covers typical/extra buffers, exact strict cutoffs, wrong origins, moved destinations, old/future road data, snapping, ambiguous/foreign/off-site locations, shared city estimates, bounded API/browser/dictionary parity, retry cooldowns, prioritization fairness, changed-fact queues and alert baseline migration. Desktop/mobile tests exercise travel preferences, supported ZIP selection and unsupported-origin behavior. Both root and `/ClassicCars` exports are built and checked.

Road coverage and intervals are planning aids, not proof of vehicle availability or ownership. Cross-listing identity still needs evidence and human review. Restricted providers remain restricted; no permission, access or credentials were invented. ORS remains an optional alternative with its own configured key and validation. Road-reachability shading is deliberately conditional on a validated polygon provider; no isochrone is fabricated from these point estimates. No collection schedule, automatic publication, Git commit or deployment is created by this work.
