# MuscleScout

A personal classic-car shopping workspace for Mustangs, Camaros and Corvettes. Next.js serves a static website; the authenticated Fastify API, SQLite database and collection worker run locally. No other project is needed.

## Project status and documentation

The initial collection contains **1,576 observed ads from nine sources**, with **1,557 included in the dated public snapshot**. These are advertisements, not a verified count of distinct physical cars: cross-listings can remain separate. Seven source adapters passed live inventory parsing checks during the initial session; Autotrader's later refresh was unavailable and 500 Classic returned 403. Strict four-hour matches remain zero until real routes are established. See the dated reports for exact scope and current known gaps.

| Start here | Contents |
|---|---|
| [HANDOFF.md](HANDOFF.md) | Delivered state, restart/transfer guidance and priorities for the next maintainer. |
| [Architecture](docs/ARCHITECTURE.md) | Code/data flow, database entities, API endpoints and boundaries. |
| [Operations](docs/OPERATIONS.md) | Environment/settings, process lifecycle, refresh, backups/restore and troubleshooting. |
| [IMPLEMENTATION_LOG.md](IMPLEMENTATION_LOG.md) | What was built and researched, fixes made and work left open. |
| [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md) | Cross-listing duplicates, every blocked/restricted source, provider gaps and prioritized acceptance criteria. |
| [SBOM.md](SBOM.md) | CycloneDX/SPDX artifacts, all lock dependencies/licenses, hashes, audit and generation limitations. |
| [LIVE_DATA.md](LIVE_DATA.md) / [SOURCE_COVERAGE.md](SOURCE_COVERAGE.md) | Dated inventory/search counts, candidate research and per-source run ledger. |
| [VALIDATION.md](VALIDATION.md) / [DECISIONS.md](DECISIONS.md) | Executed checks, unverified integrations and architecture choices. |

## Open it

Use **Node.js 24 LTS** and npm. The implementation was built and tested on macOS with Node 26.7.0; the pinned Prisma 7 stack supports Node 22.18+ and Node 24.

```sh
npm install
npm run setup
npm run dev
```

Open [MuscleScout](http://127.0.0.1:3100). The API uses [port 4410](http://127.0.0.1:4410/health). In **Settings & connection**, enter the `MUSCLESCOUT_PASSWORD` generated in the private `.env` file. Setup preserves the password, data and settings on later runs. The password is deliberately not printed or shipped to the frontend.

Alternatively, double-click `Launch MuscleScout.command` on macOS or `Launch MuscleScout.cmd` on Windows. VS Code / Cursor tasks are in `.vscode/tasks.json`. Windows and Docker launch paths are supplied but were not executed on this Mac.

`npm run dev` checks both configured ports and leaves existing applications running on conflict. Change `MUSCLESCOUT_WEB_PORT`, `MUSCLESCOUT_API_PORT` and the exact `MUSCLESCOUT_ALLOWED_ORIGINS` in `.env` together when necessary. Ctrl+C stops the local launcher. Separate commands are `npm run dev:web`, `npm run api`, and `npm run worker`. The worker can finish its current wait/request and finalization when stopping. API/worker code and environment changes require a restart; API restarts invalidate existing sessions.

## The first search

- **Everyday classics · within 4 hours** means active fixed/negotiable ads, model years 1960–1989, and a known road route of at most 240 minutes. No price, V8, transmission, originality or condition preference is silently applied. The initial strict result is empty because no routing key was supplied.
- **Travel time unknown · review** opens unresolved target candidates, including catalog observations whose availability still needs detail review. They are not claimed to be within four hours.
- **Broader regional ads** relaxes availability and sale-type preferences within the collected regional discovery pool. ClassicCars’ supported 500-mile discovery query was used to avoid undercollecting; it is not a drive-time boundary. The local discovery setting starts at 300 miles; supported remote envelopes are rounded outward, and widening beyond a source’s envelope uses broader discovery.
- **Include specialty Mustangs** starts off. It adds only the selected Mustang specialty branch, through the editable latest verified year. The initial SVT/Cobra selection does not include later ordinary Mustangs, Camaros or Corvettes. Seller-only specialty claims have their own review view; reviewed corrections can support the branch. The verified 2027 maximum comes from Ford’s marketed GTD announcement, not the calendar or ordinary Mustang retail page. GTD is an optional variant, not selected by default.
- **Nationwide classics** removes the driving cap for known US vehicle locations and, when connected, queues broader collection URLs. It does not claim the national market is covered. Specialty remains independent. New nationwide endpoints are visibly partial until actually checked.
- **Upcoming & live auctions** keeps bids and fees separate from asking prices. The one initially observed auction has unresolved phase/end/bid, so use availability “Any” to review it.

Cards open galleries, source links, evidence/claims, observation history, notes and correction tools. Shortlist and comparisons retain every underlying ad. Compare up to six cars; bid and asking-price rows remain separate. Maps show only established coordinates, group nearby pins, credit OpenStreetMap, and never draw a fabricated four-hour circle. “More filters” offers include/exclude/known/unknown/min/max rules for the canonical specification fields.

## Three independent workspaces

**Published snapshot** reads `public/data/snapshot.json`. Notes, favorites, manual entries, searches and saved comparisons live in this browser, namespaced by `musclescout`, deployment base path and mode. Import merges existing state. Export the private workspace before clearing browser data.

**Sample** is available in development. Its seven fictional records and fictional route are labeled and isolated. Sample data is compiled out of production exports and is rejected by the real database importer.

**Connected** uses the local database and private workspace. Tokens are held only in memory/sessionStorage, survive reload within the tab session and expire after eight hours. Passwords are never stored in browser storage. Logging out invalidates the backend token. Connected workspace writes use revision checks so another tab cannot silently overwrite newer data.

## Refresh inventory

```sh
npm run collect                           # bounded cycle across enabled adapters
npm run collect -- --smoke                # one inventory page and one detail per source
npm run collect -- --source=midwest --pages=2 --details=3
npm run collect -- --nationwide
npm run geocode:listings -- --limit=20     # deliberate, cached city resolution
npm run route:listings -- --limit=30       # requires ORS key; otherwise explicit no-op
npm run export:snapshot                   # redact and refresh public JSON
npm run build                             # generate static out/
```

The worker checks durable collection requests, renews database leases, records interrupted jobs and evaluates saved searches. It schedules collection at the configured interval (24 hours initially). It does not automatically geocode an arbitrary inventory. A failure or cap marks a run blocked/partial and never proves cars were removed. First-tracked time is preserved. Cache hits retain the original source/network observation time. A source can have complete catalog traversal and partial detail enrichment. Catalog page queues are not yet resumable across cycles, so repeating small caps can revisit the same early pages; per-run remaining enrichment is not a cumulative backlog.

Source configuration and allowlisted HTTPS origins are in `config/sources.json`. Runtime limits and enabled sources are in database settings, editable in the connected UI or through:

```sh
npm run config
npm run config -- my-settings.json --dry-run
npm run config -- my-settings.json
npm run import:listings -- listings.json
```

Configuration files contain the inner `settings` object printed by `npm run config`, not its wrapper. Saving parses a complete settings object and gives omitted fields defaults; use the current full object and validate a dry run first.

Use **Add a manual listing** for your own Facebook Marketplace or other permitted observations. No arbitrary source is fetched during import. Programmatic imports use the versioned canonical schema in `shared/schema.ts`; imports report rejections and preserve existing personal state. Do not use the manual workflow to circumvent a source’s collection restrictions.

## Geocoding and road routes

The default home is the **geocoded Wheaton city center**, not a private address. Edit the city/coordinates in connected provider settings. Changing home or a reviewed vehicle location invalidates old routes. Seller location is kept separate; off-site stock never inherits a seller’s route.

Nominatim was deliberately chosen for **explicit, single-threaded, cached geocoding**, not autocomplete or a recurring enumeration service. Read its [usage policy](https://operations.osmfoundation.org/policies/nominatim/). The CLI waits at least 15 seconds between network queries, supplies an identifying User-Agent, limits each run, restricts to US locations and leaves ambiguous results unresolved. `MUSCLESCOUT_GEOCODER_URL` selects an alternative compatible endpoint; `MUSCLESCOUT_GEOCODER_CONTACT` can supply contact details in the User-Agent. Source geocodes remain in `GeoCache`; do not run multiple geocoders simultaneously against the public service.

For road estimates, create your own [openrouteservice account](https://account.heigit.org/) and set `MUSCLESCOUT_ORS_KEY` in `.env`, then run `route:listings`. The observed Standard plan was €0 with 2,000 directions/day and 40/minute; check [current plans](https://account.heigit.org/info/plans) and [terms](https://account.heigit.org/info/tos) before use. The adapter calls `driving-car` with ferry avoidance and `avoid_borders: all`, requests no live traffic, and caches by provider, endpoints and routing options. ORS attribution is displayed in Settings. Use public city/vehicle coordinates, not personal street addresses, and check the trip before visiting.

Without the key, `route` stays null. Straight-line miles never become drive minutes. The default search rejects expired, future-dated, off-site and ambiguous routes. Route freshness is part of each saved search (30 days initially). ORS live response handling remains unverified without a key.

## Alerts

Each saved search owns its filters, defaults version, schedule and selected delivery channel. The first evaluation establishes a quiet baseline. Later evaluations can create new-match, meaningful asking-price and availability alerts. Bid-change and deadline alerts are opt-in; bids never become seller-price alerts. Existing searches do not silently adopt new app defaults; preview updated defaults and explicitly save the result.

In-app delivery works with the running local worker. External delivery is off until you configure both the environment destination and the backend `webhookEnabled` or `emailEnabled` setting, then select that delivery channel for the saved search. Set `MUSCLESCOUT_WEBHOOK_URL`, or `MUSCLESCOUT_SMTP_URL`, `MUSCLESCOUT_EMAIL_TO` and optional `MUSCLESCOUT_EMAIL_FROM`. Digests carry stable alert IDs, retry with backoff and expose failures in connected Settings and `/api/delivery-attempts`. Destinations should deduplicate stable IDs on uncertain network outcomes; external exactly-once delivery is not guaranteed. No external message was sent during implementation. No seller contact, bidding or purchasing feature exists.

## GitHub Pages and local production

No repository or deployment destination was supplied, so nothing has been pushed or published. The local Git repository is independent. Review source redistribution policies and export settings before authorizing public publication; **Autotrader is excluded from public snapshots by default**. Full identifier fields, raw HTML/references, the personal workspace, passwords and alert destinations are excluded by the export path. Source rights and any other sensitive content still need release review.

```sh
# User/organization site root
NEXT_PUBLIC_BASE_PATH='' npm run build
npm run serve

# Repository Pages path (substitute the actual repository name)
NEXT_PUBLIC_BASE_PATH=/ClassicCars npm run build
NEXT_PUBLIC_BASE_PATH=/ClassicCars npm run serve
```

PowerShell equivalent: `$env:NEXT_PUBLIC_BASE_PATH='/ClassicCars'; npm run build`. Only upload `out/`. `.nojekyll` is included. The supplied workflow is **manual `workflow_dispatch` only**; configure GitHub Pages to use Actions, select the actual base path and run it only after publication is authorized. The snapshot is a dated local export; Pages cannot run the API, worker, private alerts or collector.

The validated root build is in `out/`; the separate validated `/ClassicCars` build is retained in `out-subpath/`. Serve the latter using `MUSCLESCOUT_STATIC_DIR=out-subpath NEXT_PUBLIC_BASE_PATH=/ClassicCars npm run serve`. Development uses `.next-dev`, production uses `.next`, so builds do not replace the running preview.

HTTPS Pages may block HTTP/private-network API requests (mixed-content and local-network browser restrictions). Use the local website for the simplest connected workflow, or supply a reachable HTTPS backend and add the exact Pages origin to `MUSCLESCOUT_ALLOWED_ORIGINS`. Do not put credentials in public environment variables, URL parameters or Pages artifacts.

Optional Docker: run local setup first to create `.env`, then `docker compose up --build`. The dedicated `musclescout-data` volume is shared only by this app’s API and worker. Host port bindings are loopback. `docker compose down` preserves that volume; do not use `down -v` unless you intend to delete the database. Docker was not exercised here.

## Backups and verification

`npm run backup` creates a consistent SQLite copy plus a private `.env` copy in ignored `backups/`. Also preserve `data/research` and `data/cache` if you need to reprocess raw evidence without downloading again. To restore, stop MuscleScout, keep a copy of the current database/config, restore your database as `data/musclescout.db` and configuration as `.env`, then run setup. Setup only applies pending migrations; it does not replace records. Keep backup permissions private.

```sh
npm run typecheck
npm test
npm run test:e2e
npm run verify:exports    # after creating out/ and out-subpath/
npm run sbom              # regenerate installed SBOMs, lock/license inventory and hashes
```

Install the Playwright Chromium runtime with `npx playwright install chromium` if it is absent. Unit/API tests use disposable SQLite files. Browser connection tests start a separate disposable API on port 4411 and never alter the real workspace. See `VALIDATION.md` for actual checks and unverified integrations, `LIVE_DATA.md` for counts, `SOURCE_COVERAGE.md` for source gaps and `DECISIONS.md` for tradeoffs.


The software inventory command is offline and does not change dependencies or refresh advisories. The documentation-time `npm audit` result was zero reported vulnerabilities; see [SBOM provenance and scope](SBOM.md), including the optional-WASM lock-only export limitation. The private DB/cache/browser workspaces and generated build folders are not replacements for source control or independent backups.
