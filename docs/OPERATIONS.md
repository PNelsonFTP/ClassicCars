# Operations and troubleshooting

Updated September 8, 2026 UTC. Run commands from the MuscleScout project root. This supplements the [README](../README.md), [handoff](../HANDOFF.md) and [architecture](ARCHITECTURE.md).

## Install and preserve state

Use Node 24 and `npm ci` for locked repeat installations. `npm install` remains supported for the original setup contract; review intentional dependency changes in the lockfile. A clean official Node 24 macOS arm64 install and an isolated Node 24 Linux arm64 Docker build/release smoke have passed. Actual Windows execution and remote CI remain pending; consult [VALIDATION.md](../VALIDATION.md) and [Node 24 evidence](NODE24_VALIDATION.md) for dated scope.

`npm run setup` creates absent private directories/environment/password, precreates SQLite, generates Prisma, applies pending migrations and inserts only missing defaults/workspace. It preserves existing data and password. A fresh connected database starts empty; the shipped public snapshot supports static mode independently.

Before persistence-related upgrades, run `npm run backup`. Ordinary copying of a running SQLite database is not a consistent backup. New collection/review/budget states live in namespaced `Setting` records alongside existing tables.

For a legacy inventory, run `npm run operations:bootstrap` once after setup. It is safe to repeat: it fills missing source-wide detail queues and access-health records from local listings/configuration/last real run, preserves original observation dates and respects existing new-state records. It sends no requests, creates no jobs or new listing observations, and does not claim completed catalog traversal. It has already run on this workspace's real data; the [bootstrap report](validation/operations-bootstrap.json) records the result.

## Start, check and stop

| Command / action | Behavior |
|---|---|
| `npm run dev` | Checks configured ports, starts Next development UI, API and worker. |
| `npm run dev:web` | Frontend only, fixed loopback port 3100. |
| `npm run api` | Authenticated local API on configured port/bind host. |
| `npm run worker` | Durable jobs, collection schedule, alert evaluation and opted-in delivery. Does not serve HTTP. |
| `npm run serve` | Current static `out/`; no API or worker. |
| `Launch MuscleScout.command` / `.cmd` | Changes to project directory, installs missing dependencies, runs setup and combined startup. |
| Ctrl+C | Signals the owned processes; bounded current work can finalize/checkpoint. Stop separately launched processes in their own terminals. |

Check [web 3100](http://127.0.0.1:3100) and [API health 4410](http://127.0.0.1:4410/health). Agent-session processes are transient. Inspect command and working directory before signalling an orphan process; never use blanket `killall node` or stop an unrelated application to free a port.

API and worker do not watch TypeScript or `.env`; restart after backend/shared/ingest/environment changes. Next UI hot-reloads. API restart expires in-memory bearer sessions: reconnect in Settings. The worker polls every ten seconds, with longer collection cycles possible because of bounded requests and source delays. Schedule, queues and cooldowns survive restart; they do not run while the worker is stopped.

Optional user-login startup is explicit:

```sh
npm run service -- generate
npm run service -- install
npm run service -- uninstall
```

`generate` writes reviewable plans/launchd/systemd/Windows task files under `generated/local-service` and creates logs; it does not activate them. `install` uses the current platform's user-login mechanism for combined web/API/worker startup. Stop existing MuscleScout launches first. Paths include the current checkout and Node executable; regenerate after moving/upgrading either. Restart-after-error is deliberately manual to avoid occupied-port loops. `uninstall` removes the startup registration; it does not delete inventory. Local-service installation was not activated during validation, and Windows behavior still requires its actual target.

## Environment and settings

Credential values belong only in private `.env`; names/defaults are in [.env.example](../.env.example).

| Variable | Default / purpose | When changed |
|---|---|---|
| `MUSCLESCOUT_PASSWORD` | Setup generates a random password if absent | Restart API; reconnect |
| `DATABASE_URL` | `file:./data/musclescout.db` | Restart processes and migrate chosen DB |
| `MUSCLESCOUT_WEB_PORT`, `MUSCLESCOUT_API_PORT` | 3100 / 4410 | Restart launch/API; update connection/origins |
| `MUSCLESCOUT_ALLOWED_ORIGINS` | Exact loopback/localhost frontend origins | Restart API |
| `MUSCLESCOUT_BIND_HOST` | Loopback; container uses `0.0.0.0` internally | Restart; deliberately configure network/TLS exposure |
| `MUSCLESCOUT_GEOCODER_URL` | Nominatim-compatible endpoint | New CLI invocation or worker restart |
| `MUSCLESCOUT_GEOCODER_CONTACT` | Optional identifying contact | New CLI invocation or worker restart |
| `MUSCLESCOUT_ORS_KEY` | Empty; route operation reports unavailable | New CLI invocation or worker restart; never public |
| `MUSCLESCOUT_WEBHOOK_URL` | Empty alert destination | Restart worker; settings/search opt-in also required |
| `MUSCLESCOUT_SMTP_URL` | Empty SMTP transport/credentials | Restart worker |
| `MUSCLESCOUT_EMAIL_FROM`, `MUSCLESCOUT_EMAIL_TO` | Explicit sender/recipient | Restart worker; settings/search opt-in also required |
| `NEXT_PUBLIC_BASE_PATH` | Empty or `/RepositoryName`; public build value | Rebuild; match static-server base path |
| `MUSCLESCOUT_STATIC_DIR` | `out`; can select `out-subpath` | Restart static server |
| `MUSCLESCOUT_E2E_URL` | Optional browser test target | Test invocation; test server still has fixed local assumptions |

Runtime `Setting` values include home, discovery miles, enabled sources, caps, national mode, collection interval, stale/cache/route age, specialty ceiling/reference, provider daily budgets and delivery enablement. Defaults are collection every 24 hours, HTML cache 24 hours, stale after 14 days, auction freshness six hours, route freshness 30 days, geocode cache 365 days, 100 geocoder and 2,000 routing requests per UTC day, and five catalog pages/50 details per source per bounded pass.

`npm run config` prints a wrapper containing `settings`. Save the **inner full settings object** in your JSON file, validate with `npm run config -- settings.json --dry-run`, then apply without `--dry-run`. This is a full schema parse, not a merge patch; omitted fields receive defaults. Connected Settings provides the same validation. Home changes invalidate routes and straight-line distances. Request budgets/cooldowns are separate operational state; changing a setting is not a way to erase a server restriction.

## Collection jobs, queues and source review

Connected Settings/Coverage shows jobs, per-source/scoped progress, health and provider budgets. Each queued action has a UUID, scope, kind, caps, status and timestamps. Cancel cooperatively at a request/work boundary. Retry retains prior job history and existing checkpoint progress; it does not restart from an invented empty inventory. A running worker is required for UI jobs.

CLI examples:

```sh
npm run collect -- --source=midwest --pages=2 --details=3
npm run collect -- --source=midwest --smoke
npm run collect -- --nationwide
npm run coverage:report -- data/reports/configured-scope
```

Ordinary collection uses enabled permitted sources. Catalog progress is durable per source/scope/configured query, and details have independent source-wide queues, including retained legacy ads. Repeated small caps advance pending pages and details. A capped non-smoke job can continue automatically through the worker after its scheduled delay; a smoke is limited to one fresh catalog page and one detail and never expands itself into normal collection. API caps can be zero to separate catalog/detail work; use positive cap values in the CLI.

Read individual source results and `nextRunAt`. Completed means that job's work finished. Partial may mean resumable backlog, cooldown, blocked access or review; it does not imply a complete source catalog. `nextRunAt: null` requires explicit work/review. Interrupted work retains checkpoints. Source-wide/scoped pending and blocked details are distinct from a single run's processed count. Do not delete an active lease or manually edit queue JSON to force overlap.

403/challenges, robots/policy restrictions and unavailable pages remain explicit access failures. Pause a source or record a reasoned **request smoke** review in Operations after resolving its access basis. The latter can queue only the configured enabled source's bounded smoke and retains Retry-After. A review cannot enable an unauthorized source or make a challenge bypass acceptable. Successful cached HTML does not count as new live validation. Layout/network/rate-limit/budget errors are classified separately; inspect the reason and cooldown before retrying.

Persistent service budgets coordinate processes at the source/provider origin. Their counts are reserved request slots, not guaranteed successful responses. Cache hits consume no new request slot; network failures or a later cancellation can leave a reservation counted. Daily totals reset at UTC midnight; server cooldowns survive restart/day rollover. The Operations panel and `GET /api/service-budgets` expose this state.

`coverage:report` reads local configuration, queues, listings and run history only. With a filename base it writes both JSON and Markdown; without one it prints JSON. It reports configured scopes, original freshness/terminal evidence and partial versus completed declared traversal. It never asserts nationwide market completeness or performs a live check. The tracked [configured-scope report](CONFIGURED_SCOPE_VALIDATION.md) is dated evidence, not an automatically refreshed promise.

Raw cache observation dates are preserved. Rereading old HTML is not a new sighting; a failed/missing page is not proof of sale or removal. The real cached Midwest cap check and offline bootstrap did not introduce new network observations. Historical 500 Classic access failures, Autotrader unavailable/storage restrictions and other source gaps remain in [SOURCE_COVERAGE.md](../SOURCE_COVERAGE.md).

## Geography and reviewed evidence

Collection never automatically geocodes or routes. Queue an explicit bounded geocode/routes job in Operations, or run:

```sh
npm run geocode:listings -- --limit=20
npm run route:listings -- --limit=30
```

Actual US vehicle city/state/country must be established. Geocoder result evidence and cache age are validated; conflicting/ambiguous locations enter review and stop consuming repeated eligible limits. Attempt timestamps rotate remaining work across runs, with leases and persistent budgets preventing overlapping provider batches. Correct the location or use the reasoned geocode retry action to invalidate its cached query and route; the next explicit geocode run then reevaluates it. Off-site/unknown actual locations remain unknown.

Routing requires a private authorized ORS key. Estimates use configured driving-car options, no traffic, and avoid ferries/borders; route cache reads enforce current age and exact endpoints/options. A home/actual-location change invalidates routes. Later sparse observations with the same address preserve validated geography. No credential means unavailable, never a miles-to-hours estimate. Fixture/cache tests passed; real ORS route acceptance remains pending.

The evidence timeline separates source observations from year/specialty/location corrections and shows reasons/dates. Reset restores the retained source baseline and invalidates affected travel evidence. Legacy corrections without a safe baseline cannot reset until permitted source evidence supplies one. New observations preserve durable overrides.

## Cross-listing review and workspace

Duplicate review is ranked and paginated; 15 is a page size, not the total review limit. Compare identifier conflicts, seller/stock evidence and corroborating features. Seller aliases affect suggestions and require auditable reasons. Dismiss a pair with a reason or restore it later. Manual merges preserve all source-ad IDs, notes and price histories; undo replays remaining reviewed relations, including overlapping merges. Identifier conflicts block automatic grouping and require explicit acknowledgement for manual merging.

Improved matching does not establish that all similar ads are one vehicle or that all true crossposts have been found. Strong identifiers are absent in much of the original inventory; human review remains necessary. A dense candidate bucket still has unfavorable worst-case cost. Do not use the synthetic benchmark as proof that every real duplicate has been reconciled.

Snapshot/sample notes, searches, favorites and manual inventory are browser-local by app/base path/mode. Export that private UI workspace before clearing browser storage. Connecting does not automatically merge it into the backend. Connected writes require the latest revision; on 409 refresh/reconcile instead of overwriting another tab. Grouping retains source IDs, so favorites/notes remain attached to their ads.

## Alerts and delivery recovery

Choose vehicle-group or source-ad alert policy per search; enable source-added/crosspost alerts only when wanted. The first evaluation is a quiet baseline. Regrouping alone does not manufacture a new-car notification. Price, availability and optional bid/deadline changes retain their source-ad context.

External delivery needs all three: a search channel, enabled backend delivery setting and configured environment destination. Attempts are persisted and shown in Settings. Digests freeze their members and retain stable receiver keys across retries. Temporary errors back off through at most six attempts; permanent rejection/dead-letter states stop for review. Sending interrupted or timed-out work is marked uncertain because the destination may have accepted it.

Correct the destination/configuration and use the attempt's retry action. Check the destination before acknowledging an uncertain retry; the same batch/deduplication key is reused but the receiver may still deliver a duplicate. Do not change attempt rows directly to bypass that audit. No actual SMTP/webhook send has been validated; a real test requires the user's opted-in destination.

## Canonical imports and authorized feeds

UI import and `npm run import:listings -- file.json` accept canonical records without fetching URLs; sample rows are rejected in real mode. `scripts/import-research.ts` remains a one-time private research-layout utility, not a general provider refresh.

For a permission-bearing feed, follow [AUTHORIZED_FEEDS.md](AUTHORIZED_FEEDS.md):

```sh
npm run import:feed -- provider-feed.json
npm run import:feed -- provider-feed.json --apply
```

The first command is a dry run. Apply validates all rows before starting imports, enforces manifest authorization/scope/time and records an exact-page receipt/cursor chain. Replaying an identical completed page preserves original dates. Declared terminal completion applies only to the continuous feed query; absence never removes an old ad. Imported content is public only when its current permission allows it. This path requires an actual authorized export/provider; example manifests and the licensed eBay adapter do not supply access. After imports/geography, run `npm run export:snapshot` and rebuild static output if needed.

## Static builds, container and release evidence

```sh
npm run export:snapshot
npm run build:exports
npm run verify:exports
npm run serve
```

`build:exports` builds root and `/ClassicCars`, retains root in `out/` and project-path output in `out-subpath/`. The verifier uses temporary port 3160 and an isolated browser context, without the real browser workspace. For a different deployment base path use `NEXT_PUBLIC_BASE_PATH=/RepositoryName npm run build` and match it when serving. Development uses `.next-dev`, production `.next`; production uses webpack. `public/.nojekyll` is included.

Public export emits the full redacted snapshot, dictionary-packed searchable catalog and exact-ad lazy detail chunks. Connected page search limits returned/rendered rows, but still retains all matched rows and rescans per page. The 50,000-ad [scale report](validation/scale-50000.json) covers synthetic predicate parity, payload/memory/timing/candidate comparisons; it does not measure a 50,000-row real browser session or solve all worst-case memory costs.

The manually dispatched Pages workflow needs an authorized repository/destination; static hosting runs no private backend/worker. Public HTTPS-to-local-HTTP access may encounter mixed-content/local-network restrictions. Use the local frontend or a deliberately reachable HTTPS backend with an exact allowed origin. Native browser integration was tested in an actual supported Chromium feature context; ordinary unsupported browsers retain the regular UI. See [browser connectivity evidence](BROWSER_CONNECTIVITY_VALIDATION.md). A real hosted HTTPS destination is still pending.

Docker Compose has its own `musclescout` project and named data volume. Create private `.env` through setup, then `docker compose up --build`; `docker compose down` preserves data. The static container uses build-time public JSON and does not automatically read new worker exports: rebuild the static image or use connected mode. The Node 24 Linux arm64 image build and isolated release smoke passed; that does not establish Windows, other architectures or every customized Compose port configuration.

Release checks include `npm run test:release`, `npm run sbom`, `npm run sbom:artifacts`, `npm run sbom:validate` and `npm run verify:release-config`. The isolated release smoke uses its own temporary database/API port 4418 and tests setup twice, password preservation, migrations, native SQLite, backup/restore and API lifecycle. SBOM validation uses local pinned schemas and hashes; target artifacts/dpkg inventory supplement the installed dependency graph. Read [SBOM.md](../SBOM.md), [RELEASE_VALIDATION.md](RELEASE_VALIDATION.md) and [BUNDLED_WASM_REVIEW.md](BUNDLED_WASM_REVIEW.md) for limits. Target/embedded component scope is explicit; the old optional-WASM graph issue is no longer a blanket reason to skip validation.

## Backup and restore

`npm run backup` writes an SQLite `VACUUM INTO` copy and corresponding `.env` under ignored `backups/`, with owner-only permissions. Keep the pair together. It does not include raw evidence/cache, browser storage or source repository; back those up separately when needed.

1. Stop this application's API, worker and writing CLIs. Keep source/lockfile/migrations and take a fresh consistent backup before replacing state.
2. Preserve the current database, associated journal/WAL/SHM sidecars and `.env` together in a separate private location. Never mix old sidecars with a restored main database.
3. Restore the chosen consistent database to `DATABASE_URL` and its matching environment to `.env`, preserving owner-only access.
4. Run setup for pending migrations, restart and reconnect. Check inventory, settings, jobs, searches and notes before further collection or delivery. Restored pending jobs/attempts are durable; inspect them before starting the worker if the backup predates an external action.
5. Restore private raw evidence/cache when needed and import browser workspace backups into their intended mode/base path separately.

A DB-only restore cannot recover missing raw HTML/browser notes. `docker compose down -v` deletes the named data volume; ordinary `down` only stops. A public snapshot is not a private-state backup.

## Troubleshooting map

| Symptom | Check / interpretation |
|---|---|
| No four-hour matches | Requires established actual location and verified fresh routes. Review ORS setup/freshness; never convert miles to hours. |
| Nationwide fewer than review | Normal US location/availability/price filters still apply; review admits unknown candidates. Broader URLs do not prove complete coverage. |
| Specialty adds no later cars | Seller-only variants remain in review until supported/reviewed authenticity exists. |
| Similar/duplicate cards remain | Compare ranked evidence, dismiss/merge with reasons; source-ad identity and incomplete documentary evidence remain real limits. |
| Port occupied / cannot reconnect | Inspect owner, configured URL/origin/port and protocol. API restart invalidates sessions; reconnect with the local password. |
| Job queued | Confirm worker, due time, source review/cooldown and valid leases. Never delete an active lease. |
| Repeated partial job | Inspect saved checkpoint/backlog and `nextRunAt`, failed-page kinds and per-source health. Smoke is deliberately bounded. |
| 403, policy failure or unavailable HTML | Preserve prior observations; review access basis and bounded smoke. HTTP 200 can still be unusable. |
| Geocoding makes little progress | Review ambiguous/off-site/missing actual locations, home validation, request budgets and errors. Explicit retry resets reviewed query eligibility. |
| Routes unavailable or stale | Confirm private ORS key, current home/endpoints/options, route age and provider cooldown. |
| Delivery blocked/failed/uncertain | Correct configuration; inspect receiver before audited retry. Uncertain is not proof of failure. |
| Export changed but static view did not | Rebuild/deploy the export, or use connected mode. |
| Photos/map tiles fail | External hosts may deny/fail. Only the selected ad's own gallery is tried; source links and list/grid remain available. |
| SBOM validation fails | Regenerate matching installed/target evidence and inspect exact schema/hash error; do not silently substitute another platform's artifact inventory. |

Use [VALIDATION.md](../VALIDATION.md) for final test counts and dates. Live ORS, approved feed/licensed provider, opted-in SMTP/webhook, Windows and supplied hosted HTTPS acceptance remain separate from passing local fixtures/builds. No denied site or unprovided service was made available by the implementation.


## Final refresh and delivery refinements

`npm run collect -- --fresh --pages=100 --details=0` refreshes configured catalog pages through ordinary permitted requests while leaving detail enrichment separate. Zero disables that work lane; omitted caps keep configured defaults. Fresh is durable across job recovery and does not loosen source health, robots, request spacing or daily limits. A catalog-only job remains visibly partial when details remain, but does not automatically loop solely on its disabled detail backlog. A completed source/query catalog is not a claim of market completeness.

Normal and synthetic external delivery share the `alert-delivery` lease and persistent per-service budget: 100 requests per UTC day, at least one second spacing, and at most ten seconds waiting for a slot. Deferral does not increment the send-attempt count. Consent is rechecked after waiting. Deleting/disabling a saved search, changing its channel, or revoking a bid/deadline/crosspost option cancels affected queued delivery. Revocation cannot recall a message already accepted by a destination.

If a frozen digest loses some members, the old ID/membership stays in a retired audit record and allowed members receive a distinct replacement digest. An uncertain remainder still requires acknowledged retry. The browser keeps an editable backend URL separate from the authenticated endpoint. Connected workspace saves are serialized through acknowledged revisions; on conflict, export the edits still on screen before reconnecting and reconcile the other tab's changes.


The September 8 final catalog scan used fresh requests with a 500-page per-source ceiling and zero detail requests. It traversed each enabled regional catalog, then the distinct national ClassicCars catalog; Autotrader's national scope remained paused. Reproduce the permitted work with `npm run collect -- --fresh --pages=500 --details=0` followed by `npm run collect -- --source=classiccars --nationwide --fresh --pages=500 --details=0`. Shared budgets, access reviews and discovered-page limits remain active. Do not label the result a market census or completed detail enrichment. Then export, rebuild and verify the static outputs.
