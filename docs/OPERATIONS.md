# Operations and troubleshooting

Updated September 8, 2026 UTC. Commands run from the MuscleScout project root. This document supplements the [README](../README.md) and [handoff](../HANDOFF.md); it does not assume another project is installed.

## Install and preserve state

Use the locked dependencies with `npm ci` for a repeat installation. The requested initial contract `npm install` also works, but dependency changes should be reviewed in the lockfile. Node 24 is the recommended target; the executed validation host was Node 26.7.0. Windows/Node 24/Docker execution remains unverified.

`npm run setup` creates absent private directories/environment/password, precreates SQLite, generates Prisma, applies pending migrations and inserts only missing default settings/workspace. It preserves existing user data and the generated password. A new installation's connected database contains no sample or real listings until collection/import; its shipped public snapshot still supports static mode.

Run `npm run backup` before a migration or dependency upgrade that affects persistence. Do not copy a running database with ordinary file-copy commands and assume a consistent snapshot; use the provided SQLite backup path.

## Start, check and stop

| Command / action | Behavior |
|---|---|
| `npm run dev` | Checks configured web/API ports, then starts Next development UI, API and worker. |
| `npm run dev:web` | Convenience frontend-only command fixed to loopback port 3100. |
| `npm run api` | Starts the authenticated local API using configured port/bind host. |
| `npm run worker` | Starts the polling worker; does not serve HTTP or automatically geocode. |
| `npm run serve` | Serves the current static `out/`; starts neither API nor worker. |
| `Launch MuscleScout.command` / `.cmd` | Changes to its own project directory, installs dependencies if missing, runs setup and combined startup. |
| Ctrl+C in combined launcher | Signals its children; current bounded waits/requests and finalization can finish. |
| Ctrl+C in separate terminals | Stop each MuscleScout frontend/API/worker you started. |

Check [web 3100](http://127.0.0.1:3100) and [API health 4410](http://127.0.0.1:4410/health). Processes started during an agent session are transient, not an installed system service. If a terminal/session is no longer accessible, inspect the owning process's working directory/command and signal only that application's process. Do not use blanket `killall node` or stop an unrelated app to free a port.

API and worker are direct TypeScript processes without watch mode. Restart them after backend/shared/ingest code or `.env` changes. Next's development UI hot-reloads. Restarting the API invalidates its in-memory bearer sessions; reconnect through Settings. The worker polls every ten seconds, but a collection cycle can take longer because of policy delays and bounded requests.

## Environment configuration

Names below are public; actual credential values belong only in your private `.env`. See [.env.example](../.env.example).

| Variable | Default / purpose | Restart or rebuild |
|---|---|---|
| `MUSCLESCOUT_PASSWORD` | Setup generates a fresh random password if absent | Restart API; reconnect |
| `DATABASE_URL` | `file:./data/musclescout.db` | Restart API/worker/CLI; migrate chosen database |
| `MUSCLESCOUT_WEB_PORT` | 3100 for combined/static server | Restart launcher/static server |
| `MUSCLESCOUT_API_PORT` | 4410 | Restart API; update frontend connection URL |
| `MUSCLESCOUT_ALLOWED_ORIGINS` | Exact `http://127.0.0.1:3100,http://localhost:3100` | Restart API; update when changing host/port |
| `MUSCLESCOUT_BIND_HOST` | Loopback; Docker uses `0.0.0.0` inside its container | Restart service; consider network exposure before changing |
| `MUSCLESCOUT_GEOCODER_URL` | Public Nominatim-compatible endpoint | Read on CLI invocation |
| `MUSCLESCOUT_GEOCODER_CONTACT` | Optional identifying contact in geocoder User-Agent | Read on CLI invocation |
| `MUSCLESCOUT_ORS_KEY` | Empty; road routing returns unavailable | Read on CLI invocation; never public |
| `MUSCLESCOUT_WEBHOOK_URL` | Empty external alert destination | Restart worker; also requires settings/search opt-in |
| `MUSCLESCOUT_SMTP_URL` | Empty transport configuration/credentials | Restart worker |
| `MUSCLESCOUT_EMAIL_FROM`, `MUSCLESCOUT_EMAIL_TO` | Optional sender and explicit recipient | Restart worker; also requires settings/search opt-in |
| `NEXT_PUBLIC_BASE_PATH` | Empty or `/RepositoryName`; this value is public | Rebuild frontend; matching static-server path required |
| `MUSCLESCOUT_STATIC_DIR` | `out` | Restart static server; can select `out-subpath` |
| `MUSCLESCOUT_E2E_URL` | Optional browser-test target | Test invocation only; test webServer configuration still has fixed local assumptions |

Runtime settings live in `Setting`, not in the environment: home city/coordinates, discovery miles, source enablement, page/detail caps, cache/staleness policy, route age, specialty ceiling/reference, national mode, collection interval and delivery enablement. Default collection is 24 hours, HTML cache 24 hours, stale status 14 days and route freshness 30 days. Default per-source caps are five catalog pages and 50 details.

`npm run config` prints a wrapper containing `settings`; when saving a configuration file, put the **inner settings object** in the JSON file. The import is a complete schema parse, not a merge patch: omitted fields receive defaults. Start from the current full settings, validate `npm run config -- settings.json --dry-run`, then save intentionally. Connected Settings offers the same dry-run path. Changing home invalidates routes and straight-line distances.

## Collection and enrichment workflow

1. Read the last source statuses, policy dates and run counters. Enable only sources whose current configured access is permitted.
2. Run `npm run collect -- --smoke` for a bounded check, or select a source and explicit caps, for example `npm run collect -- --source=midwest --pages=2 --details=3`.
3. Read each source's result. Outer `finished` does not mean every source succeeded. `partial`, `blocked`, failed-page counts and remaining work explain gaps. Fresh cached detail work may be skipped rather than counted as a new request.
4. Resolve actual vehicle locations from detail evidence/review. Run one explicit geocoder at a time: `npm run geocode:listings -- --limit=20`. Review ambiguous entries; currently they can consume future limits repeatedly.
5. With an authorized ORS key, run `npm run route:listings -- --limit=30`. Without a key, no driving estimates are fabricated. Route cache freshness and live provider behavior have documented open checks.
6. Run `npm run export:snapshot` after imports/geography work, and rebuild static output if needed. Collection itself exports JSON after a completed cycle; it does not rebuild the website output.

`npm run collect -- --nationwide` uses broader configured URLs. The connected nationwide control creates a durable request for the running worker. A single setting currently coalesces requests; it is not a queue of separately tracked jobs. Merely removing the travel cap from a snapshot does not establish national coverage.

Catalog pagination queues restart each cycle; repeated low caps do not yet guarantee eventual traversal of deeper pages. Detail rotation operates on ads rediscovered within that cycle. A latest run's remaining-detail number is not a source-wide backlog. Do not increase request rates to compensate for missing durable cursors; implement the queued-progress work described in the backlog.

Raw cache files retain network observation dates. Re-reading cached HTML is not a new sighting. A source error is not evidence of a sale/removal. Keep 403/challenge/policy failures stopped; do not use imported cookies or alternative identities to bypass them. Source configuration and latest run health can differ because they describe baseline feasibility versus recent execution.

The initial `scripts/import-research.ts` is a one-time import utility for this session's private research layout. It is not a general external feed or the normal refresh command. Ordinary user imports use the canonical schema through the UI or `npm run import:listings -- file.json` and do not fetch those URLs.

## Workspace and alerts

Snapshot/sample notes, searches, favorites and manual inventory are browser-local, separately keyed by app/base path/mode. Back them up using private UI export before clearing site data. Connecting does not automatically merge those workspaces into the backend. Connected writes use a revision; on a 409 conflict, refresh/reconcile the latest workspace instead of blindly overwriting another tab's changes.

The first saved-search evaluation creates a quiet baseline. Subsequent new-match, meaningful ask changes and availability changes are evaluated on schedule while the worker runs. Bid/deadline options are separate. Delivery requires the chosen search channel, enabled backend setting and configured environment destination. Connected Settings exposes attempts/failures. No real SMTP/webhook delivery has been validated; do not rely on it until an opted-in test succeeds. Cross-post alerts may still duplicate at the physical-car level.

## Static builds and deployment

```sh
NEXT_PUBLIC_BASE_PATH='' npm run build
npm run serve
```

For a repository path, build with `NEXT_PUBLIC_BASE_PATH=/ClassicCars` and serve with the same value. Each build overwrites `out/`. To retain both variants, copy/move the first output to a deliberately named ignored output folder before the second build; preserve root as `out` and the project-path build as `out-subpath` for `npm run verify:exports`. This verifier binds temporary port 3160 and uses an isolated browser context. It does not touch the real browser workspace.

Development uses `.next-dev`, production `.next`; webpack is the production compiler due to the observed Turbopack socket issue. `public/.nojekyll` is included. The manual Pages workflow uploads only static output and needs an authorized repository/destination. Nothing in Pages runs the private backend or worker. Mixed-content/local-network browser rules may prevent public HTTPS Pages from reaching a local HTTP API; use the local website or a deliberately reachable HTTPS backend with an exact allowed origin.

Docker Compose has its own `musclescout` project and named data volume. It requires a local `.env` created by setup, then `docker compose up --build`; `docker compose down` preserves data. The static web image contains its build-time `out`, and does not automatically read the worker's updated snapshot. Rebuild the static image or use connected mode. The supplied container path has not been executed here, and host configured ports must match Compose bindings if customized.

## Backup and restore

`npm run backup` creates an SQLite `VACUUM INTO` copy and corresponding `.env` under ignored `backups/`, with owner-only permissions. Keep the pair together. It does not include raw cache/research directories, browser storage or the source repository; back those up separately when needed.

For restore:

1. Stop this application's API, worker and any CLI that can write the database. Keep your current source/lockfile/migrations and take a new backup before replacing state.
2. Preserve the current database, any associated journal/WAL/SHM sidecars, and `.env` together in a separate private backup location. Do not mix stale sidecars with a restored main database.
3. Restore the chosen consistent database to the configured `DATABASE_URL` location and its matching environment to `.env`. Preserve owner-only directory/file access.
4. Run setup to apply pending migrations, restart and reconnect. Verify representative inventory, settings, saved searches and notes before enabling more collection or external delivery.
5. Restore private raw evidence/cache only if needed, and import browser workspace backups into their intended mode/base path separately.

A database-only restore cannot recover missing raw HTML or browser-only notes. `docker compose down -v` deletes the named database volume; use ordinary `down` for stopping. Do not treat a public snapshot as a full backup of private state.

## Troubleshooting map

| Symptom | Check / interpretation |
|---|---|
| No four-hour matches | Expected without verified fresh routes; open travel-time review. Check actual location, ORS setup and freshness, not a miles-to-hours conversion. |
| Nationwide shows fewer results than review | It still requires known US vehicle location and normal active/fixed filters; review admits unknown status/location candidates. |
| Specialty toggle adds no later cars | Seller-only variants stay in specialty review; the initial later cars have no supported/reviewed authenticity. |
| Many similar or duplicate-looking cards | Ads are source records; grouping is incomplete. See the cross-listing backlog and compare source evidence. |
| “Port occupied” | A service already owns it; inspect ownership or change only MuscleScout ports/origins. |
| Cannot connect after restart | Backend sessions are process-local; reconnect with the local password. Check URL, exact origin, port and HTTPS/private-network restrictions. |
| Collection button stays queued | Check the local worker is running and whether the collection lease is legitimately held. |
| Repeated partial counts | Inspect caps, source errors, current run scope and non-resumable catalog pagination. A smoke run is not a full refresh. |
| Source 403 / unavailable HTML / layout error | Preserve prior observations, stop restricted access and consult the source register. HTTP 200 can still be an unusable page. |
| Geocoding makes little progress | Missing actual location or early ambiguous records may consume the limit. Correct them explicitly and avoid concurrent public-service requests. |
| Data export changed but static site did not | Rebuild/deploy the dated static output, or use the live connected view. |
| Images or map tiles missing | Remote hosts may fail or deny access; use source links and list/grid. No unrelated image is substituted. |
| “Lease busy” / interrupted run | Allow the live process or lease expiry/recovery to finish. Do not delete active leases to force concurrent collection. |
| SBOM lock-only command fails | Known optional-WASM bundled-edge limitation; use the shipped installed-graph generator and read [SBOM scope](../SBOM.md). |

For test commands and actual evidence, see [VALIDATION.md](../VALIDATION.md). Keep that document dated and do not label a source/service validated until the corresponding check has really run.
