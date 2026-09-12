# MuscleScout

## September 12 source-access improvement

The [access audit and operating guide](docs/SOURCE_ACCESS.md) replaces blanket “AI blocked” labels with dated methods, evidence and next steps for all 26 sources. Fixed robots user-agent matching and JWS content negotiation, added catalog-only collection, deterministic HTTP/Chromium diagnostics, and incomplete private feed templates for every configured source. The new JWS scan found 44 advertised vehicles and eight matching classics, **all explicitly sold**; it added no active stock or known asking prices. Current totals are **3,284 retained ads / 3,262 groups**, **3,265 public ads / 3,249 public groups**. This access audit does not redate the earlier inventory refresh.

403 responses remain for Duffy’s, 500 Classic and Classics on Autotrader in HTTP/Chromium tests. Autotrader still serves an unavailable template. Forum, auction and other provider restrictions, missing eBay access, unresolved cross-listings, the ClassicCars detail backlog and J & S 404s remain documented. No new dependencies or credentials were added. [Machine-readable access evidence](docs/validation/source-access-2026-09-12.json).

A personal classic-car shopping workspace for Mustangs, Camaros and Corvettes. Next.js serves a static website; the authenticated Fastify API, SQLite database and collection worker run locally. No other project is needed.

[GitHub repository](https://github.com/PNelsonFTP/ClassicCars) · [GitHub Pages website](https://pnelsonftp.github.io/ClassicCars/) · [Delivery and deployment status](docs/DELIVERY.md)

## Project status and documentation

Version **1.1.0** implements the 19-item reliability and product backlog: durable collection/jobs, evidence-ranked duplicate review, group-aware alerts, shared service budgets, provenance/reset, live snapshot aging, permission-aware feeds, compact catalogs, release checks and validated SBOMs. The [implementation map](docs/IMPROVEMENTS_STATUS.md) records every item and its remaining real-world acceptance work.

The **September 12, 2026 refresh** retains **3,276 ads / 3,254 groups**, including **3,257 public ads**. It added **79 ads**, observed **47 numeric asking-price changes** (37 decreases, 10 increases), and refreshed details for **226 distinct ads**. All accessible configured catalogs completed: 25 regional and 49 national ClassicCars pages plus 20 dealer pages, with no catalog failures or cache hits. Five dealer detail queues are fully fresh; J & S Motors has 22 refreshed details and two older URLs returning 404. ClassicCars completed its configured 50-detail batch; 3,026 details remain due, rather than blocked by the daily budget. Autotrader and 500 Classic remain paused without new requests. See the [dated comparison](docs/validation/refresh-2026-09-12-comparison.md) for original observation dates and exact limits. Ads and groups are not verified unique physical vehicles; strict four-hour matches still require actual road routes.

The [September 8 release scan](docs/validation/inventory-full-scan.json) remains dated historical evidence: 93 catalog pages, 3,139 retained ads and 3,120 public ads. The new refresh does not redate earlier platform, Docker, SBOM or advisory checks.

| Start here | Contents |
|---|---|
| [HANDOFF.md](HANDOFF.md) | Delivered state, restart/transfer guidance and priorities for the next maintainer. |
| [Architecture](docs/ARCHITECTURE.md) | Code/data flow, database entities, API endpoints and boundaries. |
| [Operations](docs/OPERATIONS.md) | Environment/settings, process lifecycle, refresh, backups/restore and troubleshooting. |
| [IMPLEMENTATION_LOG.md](IMPLEMENTATION_LOG.md) | What was built and researched, fixes made and work left open. |
| [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md) | Delivered improvements, remaining cross-listing/source struggles and external acceptance requirements. |
| [SBOM.md](SBOM.md) | CycloneDX/SPDX artifacts, all lock dependencies/licenses, hashes, audit and generation limitations. |
| [LIVE_DATA.md](LIVE_DATA.md) / [SOURCE_COVERAGE.md](SOURCE_COVERAGE.md) | Dated inventory/search counts, candidate research and per-source run ledger. |
| [VALIDATION.md](VALIDATION.md) / [DECISIONS.md](DECISIONS.md) | Executed checks, unverified integrations and architecture choices. |

## Open it

Use **Node.js 24 LTS** and npm. Clean macOS arm64 Node 24.20.0 and Linux arm64 Docker Node 24.20.0 installation/release checks passed. The development host uses Node 26.7.0. Node 22.18+ remains the declared minimum; Node 22.18.0 now passes the Linux CI release and SBOM checks. See [current remote validation](docs/DELIVERY.md) for the full platform matrix.

```sh
npm install
npm run setup
npm run dev
```

Open [MuscleScout](http://127.0.0.1:3100). The API uses [port 4410](http://127.0.0.1:4410/health). In **Settings & connection**, enter the `MUSCLESCOUT_PASSWORD` generated in the private `.env` file. Setup preserves the password, data and settings on later runs. The password is deliberately not printed or shipped to the frontend.

Session status on September 10: web preview 3100 and API 4410 are running; the background worker remains off. The project now uses the public [PNelsonFTP/ClassicCars repository](https://github.com/PNelsonFTP/ClassicCars); [delivery status](docs/DELIVERY.md) records Pages deployment and remote checks.

Alternatively, double-click `Launch MuscleScout.command` on macOS or `Launch MuscleScout.cmd` on Windows. VS Code / Cursor tasks are in `.vscode/tasks.json`. The Windows launcher still needs a Windows run. The Docker image build and isolated Linux release checks passed; Compose deployment is a separate optional step.

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

**Published snapshot** reads the compact dictionary-encoded `public/data/catalog.json`, with content-addressed detail files fetched only when an ad is opened. `snapshot.json` remains the full compatibility export. Source observation times and freshness policy are evaluated in the browser every 30 seconds; a frozen export does not look freshly checked. Notes, favorites, manual entries, searches and saved comparisons live in this browser, namespaced by `musclescout`, deployment base path and mode. Import merges existing state. Export the private workspace before clearing browser data.

**Sample** is available in development. Its seven fictional records and fictional route are labeled and isolated. Sample data is compiled out of production exports and is rejected by the real database importer.

**Connected** uses the local database and private workspace. Tokens are held only in memory/sessionStorage, survive reload within the tab session and expire after eight hours. Passwords are never stored in browser storage. Logging out invalidates the backend token. Connected workspace writes use revision checks so another tab cannot silently overwrite newer data.

## Refresh inventory

```sh
npm run collect                           # bounded cycle across enabled adapters
npm run collect -- --smoke                # one inventory page and one detail per source
npm run collect -- --source=midwest --pages=2 --details=3
npm run collect -- --nationwide
npm run collect -- --fresh --pages=100 --details=0  # catalog refresh; details remain queued
npm run geocode:listings -- --limit=20     # deliberate, cached city resolution
npm run route:listings -- --limit=30       # requires ORS key; otherwise explicit no-op
npm run export:snapshot                   # redact and refresh public JSON
npm run build                             # generate static out/
```

The worker claims durable jobs with IDs, renews leases, recovers interrupted work and evaluates saved searches. Source/scope/query checkpoints resume catalog pagination across capped runs; independent detail queues include previously discovered ads. Connected Settings exposes total/pending/blocked work, source health, budgets and job cancellation/retry. Complete cycles advance the normal schedule; partial cycles retain progress and retry later. Geocoding/routes run only when explicitly requested. Failed pages never imply removal, and cached reads preserve original observation dates. HTTP 403/policy/layout failures pause for review; transient failures use persisted cooldowns and Retry-After. A repair requires a fresh permitted catalog-and-detail smoke check.

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

Nominatim was deliberately chosen for **explicit, single-threaded, cached geocoding**, not autocomplete or a recurring enumeration service. Read its [usage policy](https://operations.osmfoundation.org/policies/nominatim/). The CLI waits at least 15 seconds between network queries, supplies an identifying User-Agent, limits each run, restricts to US locations and leaves ambiguous results unresolved. `MUSCLESCOUT_GEOCODER_URL` selects an alternative compatible endpoint; `MUSCLESCOUT_GEOCODER_CONTACT` can supply contact details in the User-Agent. Source geocodes remain in `GeoCache`. Database leases and persisted per-provider budgets serialize work across processes. Ambiguous records move to review instead of monopolizing later small runs; a reviewed retry explicitly invalidates their cache. Returned city, state, country and settlement evidence must agree before coordinates are accepted.

For road estimates, create your own [openrouteservice account](https://account.heigit.org/) and set `MUSCLESCOUT_ORS_KEY` in `.env`, then run `route:listings`. Check your [current plan](https://account.heigit.org/info/plans) and [terms](https://account.heigit.org/info/tos) before use. Configured daily quotas and provider cooldowns are persisted across processes. The adapter calls `driving-car` with ferry avoidance and `avoid_borders: all`, requests no live traffic, and caches by provider, endpoints and routing options. ORS attribution is displayed in Settings. Use public city/vehicle coordinates, not personal street addresses, and check the trip before visiting.

Without the key, `route` stays null. Straight-line miles never become drive minutes. The default search rejects expired, future-dated, off-site and ambiguous routes. Route freshness is part of each saved search (30 days initially). ORS live response handling remains unverified without a key.

## Alerts

Each saved search owns its filters, defaults version, schedule, vehicle/ad alert policy and selected delivery channel. Vehicle-level new-match policy is the default; new source/crosspost notifications are separately opt-in. Source-specific asking histories remain separate through grouping and undo. The first evaluation establishes a quiet baseline. Later evaluations can create new-match, meaningful asking-price and availability alerts. Bid-change and deadline alerts are opt-in; bids never become seller-price alerts. Existing searches do not silently adopt new app defaults; preview updated defaults and explicitly save the result.

In-app delivery works with the running local worker. External delivery is off until you configure both the environment destination and the backend `webhookEnabled` or `emailEnabled` setting, then select that delivery channel for the saved search. Set `MUSCLESCOUT_WEBHOOK_URL`, or `MUSCLESCOUT_SMTP_URL`, `MUSCLESCOUT_EMAIL_TO` and optional `MUSCLESCOUT_EMAIL_FROM`. Digests freeze their membership and stable receiver keys, use bounded SMTP deadlines, and expose retry/blocked/uncertain/dead-letter states in connected Settings. Revoked saved-search delivery consent is checked before sending. Uncertain sends require explicit acknowledgment before retry; retired batches retain their audit identity. Destinations should deduplicate stable IDs on uncertain network outcomes; external exactly-once delivery is not guaranteed. No external message was sent during implementation. No seller contact, bidding or purchasing feature exists.

## GitHub Pages and local production

The user reviewed the local preview and approved final delivery. See [delivery status](docs/DELIVERY.md) for the repository, website and remote checks. **Autotrader is excluded from public snapshots by default**. Full identifier fields, raw HTML/references, the personal workspace, passwords and alert destinations are excluded by the export path. Review source redistribution policies and export settings for future refreshes.

```sh
# User/organization site root
NEXT_PUBLIC_BASE_PATH='' npm run build
npm run serve

# Repository Pages path (substitute the actual repository name)
NEXT_PUBLIC_BASE_PATH=/ClassicCars npm run build
NEXT_PUBLIC_BASE_PATH=/ClassicCars npm run serve
```

PowerShell equivalent: `$env:NEXT_PUBLIC_BASE_PATH='/ClassicCars'; npm run build`. Only upload `out/`. `.nojekyll` is included. The Pages publication workflow is **manual `workflow_dispatch` only**; configure GitHub Pages to use Actions, select the actual base path and run it only after publication is authorized. The snapshot is a dated local export; Pages cannot run the API, worker, private alerts or collector.

The validated root build is in `out/`; the separate validated `/ClassicCars` build is retained in `out-subpath/`. Serve the latter using `MUSCLESCOUT_STATIC_DIR=out-subpath NEXT_PUBLIC_BASE_PATH=/ClassicCars npm run serve`. Development uses `.next-dev`, production uses `.next`, so builds do not replace the running preview.

HTTPS Pages may block HTTP/private-network API requests (mixed-content and local-network browser restrictions). Use the local website for the simplest connected workflow, or supply a reachable HTTPS backend and add the exact Pages origin to `MUSCLESCOUT_ALLOWED_ORIGINS`. Do not put credentials in public environment variables, URL parameters or Pages artifacts.

Optional Docker: run local setup first to create `.env`, then `docker compose up --build`. The dedicated `musclescout-data` volume is shared only by this app’s API and worker. Host port bindings are loopback. `docker compose down` preserves that volume; do not use `down -v` unless you intend to delete the database. The pinned Linux arm64 image built successfully and passed isolated setup/migration/native-SQLite/backup/API checks. The static web image holds build-time data; refresh and rebuild it or use connected mode. No Compose deployment or OS service was installed.

## Operational and feed tools

```sh
npm run operations:bootstrap   # upgrade retained observations into queues; no requests/jobs
npm run coverage:report        # configuration/checkpoint scope evidence; no collection
npm run service -- generate    # inspect optional OS startup templates
npm run import:feed -- config/authorized-feed.example.json
npm run verify:routing         # readiness only unless a key and explicit --live are supplied
npm run verify:delivery -- --channel=webhook # readiness only; sending requires --send-test
```

The feed example is a synthetic format template, not real inventory or a permission grant. Review [authorized feed setup](docs/AUTHORIZED_FEEDS.md) for actual importer arguments, permissions, expiry, documented specialties and separate auction values. Import is dry-run unless `--apply` is supplied. eBay support requires approved production access and reviewed whole-vehicle category evidence; it is not automatically enabled.

`npm run service -- install` installs only this application's startup entry for the current OS; `uninstall` removes that exact owned entry. Stop existing MuscleScout processes before enabling a startup copy. Only template generation was executed in this session.

The CI workflow runs on push/PR/manual dispatch and checks the platform matrix, browser flows, static exports, release smoke and SBOM changes. Direct actions and the Node container image are pinned. Actual remote run results are recorded in [delivery status](docs/DELIVERY.md).

## Backups and verification

`npm run backup` creates a consistent SQLite copy plus a private `.env` copy in ignored `backups/`. Also preserve `data/research` and `data/cache` if you need to reprocess raw evidence without downloading again. To restore, stop MuscleScout, keep a copy of the current database/config, restore your database as `data/musclescout.db` and configuration as `.env`, then run setup. Setup only applies pending migrations; it does not replace records. Keep backup permissions private.

```sh
npm run typecheck
npm test
npm run test:e2e
npm run test:release      # disposable DB: setup, migration, restore, API
npm run build:exports     # root out/ and /ClassicCars out-subpath/
npm run verify:exports
npm run sbom              # installed graph + complete lock/license inventory
npm run sbom:artifacts    # native/WASM and target OS evidence
npm run sbom:validate     # pinned full schemas and artifact hashes
```

Install the Playwright Chromium runtime with `npx playwright install chromium` if it is absent. Unit/API tests use disposable SQLite files. Browser connection tests start a separate disposable API on port 4411 and never alter the real workspace. See `VALIDATION.md` for actual checks and unverified integrations, `LIVE_DATA.md` for counts, `SOURCE_COVERAGE.md` for source gaps and `DECISIONS.md` for tradeoffs.


The software inventory command is offline and does not change dependencies or refresh advisories. The documentation-time `npm audit` result was zero reported vulnerabilities; see [SBOM provenance and scope](SBOM.md), including observed optional-WASM versions and separate target inventories. The private DB/cache/browser workspaces and generated build folders are not replacements for source control or independent backups.
