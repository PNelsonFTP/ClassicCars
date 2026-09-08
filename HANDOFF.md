# MuscleScout handoff

Documentation updated September 8, 2026 UTC. This handoff covers the initial build requested in [MuscleCarPrompt.md](MuscleCarPrompt.md) and the follow-up documentation/SBOM audit. Inventory observations and validation dates are separate from this document's update date.

## Current deliverable

MuscleScout is a working personal car-search workspace with a static Next/React frontend, separate authenticated Fastify API, Prisma/SQLite persistence, local worker, nine source adapters, explicit geocoding/routing commands and three isolated workspace modes. The implementation is in this project directory and does not depend on the boating project.

| Area | Handoff state |
|---|---|
| Local website | [http://127.0.0.1:3100](http://127.0.0.1:3100); started during implementation. Process availability is not permanent. |
| Local backend | Loopback port 4410; [health endpoint](http://127.0.0.1:4410/health). Password lives only in the private local environment. |
| Worker | Started separately during implementation; must remain running for scheduled collection, queued requests and alert evaluation. No OS startup service is installed. |
| Database | `data/musclescout.db`, 1,576 observed ads, 1,576 current groups at the documentation audit. These are not 1,576 verified unique physical cars. |
| Public snapshot | 1,557 ads, generated `2026-09-08T03:16:07.457Z`; Autotrader's 19 records excluded by export settings. |
| Static exports | Root build in `out/`; `/ClassicCars` build in `out-subpath/`. Both were browser-verified locally. These ignored build folders can be recreated. |
| Tests | Initial handoff passed 52 unit/API/adapter/security tests, 10 desktop/mobile browser tests, both production builds and export isolation checks. See dated [validation](VALIDATION.md). |
| Routing | Wheaton city center geocoded; no ORS credential supplied. Zero actual road routes established. |
| Publication | No remote repository or destination supplied; no push or public deployment performed. Local repository currently has no initial commit; project files are working-tree files. |
| SBOM | Installed-graph CycloneDX and SPDX, runtime subset, all 458 lock entries, license inventory, hashes and dated audit. See [SBOM.md](SBOM.md). |

The documentation audit did not launch new collectors, change inventory or personal data, or send external alerts. It added documentation, a reproducible SBOM command and dependency reports; it also identified additional implementation limits for the backlog.

## First use or resume

Open the website and choose **Review cars**. The strict four-hour search is intentionally empty until genuine road estimates exist. Use **Settings & connection** to enter the generated `MUSCLESCOUT_PASSWORD` from your local `.env` and connect to the backend. Do not copy that value into documentation or public build configuration.

If the services are no longer running, use a terminal in this directory:

```sh
npm ci
npm run setup
npm run dev
```

For the existing populated installation, `npm run setup` preserves the database, password, settings and workspace. `npm ci` reinstalls the locked dependencies; it does not contain or recreate the private real-inventory database. A fresh clone starts with a dated public snapshot, while its new connected database is empty until collection or an intentional private restore/import.

If 3100 or 4410 is occupied, inspect which application's process owns it or change this application's ports and exact allowed origins. Do not stop an unrelated application. The combined launcher cannot start a second copy over the separately started services. See [operations](docs/OPERATIONS.md) for stopping and restarting just MuscleScout.

## What was delivered

- Search defaults for Mustang/Camaro/Corvette, model years 1960–1989; explicit unknown-value handling; Camero normalization; verified model/generation boundaries and separate advertised-year text.
- Strict routed travel, unknown-route review, broad regional discovery, nationwide job expansion and a separate specialty-Mustang toggle. Seller-only specialty claims remain a review category.
- Real source images, grid/list/map, source coverage and run detail, favorites, private notes/data flags, comparison up to six ads, saved comparisons/searches, manual entries/import/export and reviewed identity/location edits.
- Versioned canonical schema, separate vehicle/seller locations, evidence-bearing specifications, source/ask/bid/availability observations, first-seen preservation, conservative grouping and reversible reviewed merges.
- Authenticated single-user API, session-scoped tokens, optimistic workspace revisions, explicit external delivery opt-in, durable alert attempts, private raw cache, bounded fetches, access-policy checks and source-isolated errors.
- Renewable collection/worker leases, bounded per-source work, request/detail counters, retained original cache timestamps, explicit geocoding, ORS adapter and honest missing-key fallback.
- Setup, migrations, combined/separate launch commands, macOS/Windows launchers, VS Code tasks, optional Docker configuration, root/subpath Pages builds, manual publication workflow and backup/restore guidance.
- Three dated research reports, live-data and source/run ledgers, validation record, implementation decisions, build history and a prioritized improvement register.

The [implementation log](IMPLEMENTATION_LOG.md) records concrete fixes made during development. The [architecture](docs/ARCHITECTURE.md) maps those features to files, entities and endpoints.

## Open items the next maintainer should read first

| Priority | Unfinished area | Practical effect and next step |
|---|---|---|
| P1 | Cross-listed vehicle identity | No existing automatic groups were found. Many marketplace/dealer ads can still represent the same physical car; weak exact-title suggestions are noisy and only 15 pairs appear in review. Build evidence-ranked, paginated review before claiming unique-car counts. |
| P1 | Source access and coverage | Autotrader refresh became unavailable, 500 Classic returns 403, several other sites restrict access or require approved APIs. Prior records remain; never treat blocked sources as empty. Consult the source-specific register before new requests. |
| P1 | Resumable collection | Detail attempts rotate, but catalog page queues restart each cycle. Repeated small caps can keep revisiting early pages. Add durable source/scope cursors and queues with progress tests. |
| P1 | Real routes and geography progress | Add a permitted ORS key, verify representative road routes, fix cache freshness consistency and geocoder fairness. Keep strict results empty for unresolved cars meanwhile. |
| P1 | Duplicate alerts across crossposts | Alerts are keyed to ad IDs, and group representative changes can appear as new matches. Specify vehicle-level versus ad-level notification behavior and test transitions. |
| P2 | Staleness, evidence and job operations | Static availability is frozen at export; some source/user provenance is DB-only; a single coalescing collection request has no resumable job dashboard. Improve these deliberately. |
| P2 | External services and platforms | SMTP/webhook, actual Pages/HTTPS connectivity, Windows, Node 24 execution, Docker and supported WebMCP context remain unverified. |

Full causes, mitigations, evidence and acceptance criteria are in [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md). Read it together with [SOURCE_COVERAGE.md](SOURCE_COVERAGE.md); neither document promises completeness or unrestricted access.

## Data and transfer checklist

| Keep / transfer | Reason |
|---|---|
| Source, lockfile, migrations, configs, docs and fixtures | Reproducible software and review evidence; safe to version after the ordinary publication review. |
| `public/data/snapshot.json` | Dated redacted real inventory for static mode. Source redistribution decisions still apply. |
| Private consistent DB backup + matching `.env` | Connected inventory, notes, settings, searches, history and credentials. Transfer privately, separately from a public repository. |
| `data/research/` and `data/cache/` | Private raw source evidence and original timestamps. The DB backup command does not copy these directories. |
| Browser workspace export per mode/path | Snapshot/sample notes and favorites are not in the backend DB. Clearing browser data loses them without a separate export. |
| `out/`, `out-subpath/`, `node_modules/`, test screenshots | Disposable outputs, not the authoritative source. Rebuild/reinstall as needed. |

Never merge another project's `.env`, browser keys, ports, databases or Docker volumes into this one. The boating service remained reachable on its separate port during implementation; same-origin storage isolation was tested with MuscleScout's two builds and a synthetic separate-app sentinel, not by modifying BoatScout's real browser workspace.

Before another release, regenerate SBOMs after dependency changes, rerun the checks relevant to changed behavior, refresh the source/snapshot dates, confirm export exclusions and build the intended base path. A commit/tag and deployment destination should identify an actual reviewed release; none is invented in this handoff.

## Documentation map

| Document | Purpose |
|---|---|
| [README](README.md) | User entry point, controls and command overview. |
| [Operations](docs/OPERATIONS.md) | Configuration, processes, refresh, backups, restore and troubleshooting. |
| [Architecture](docs/ARCHITECTURE.md) | Code/data flow, entities, API and security boundaries. |
| [Implementation log](IMPLEMENTATION_LOG.md) | What was built, researched, corrected and verified. |
| [Decisions](DECISIONS.md) | Architectural choices and tradeoffs. |
| [Live data](LIVE_DATA.md) | Dated ads/groups/search counts and interpretation. |
| [Source coverage](SOURCE_COVERAGE.md) | Every candidate, live scope, pagination and run history. |
| [Validation](VALIDATION.md) | Executed checks versus unverified integrations. |
| [Future improvements](FUTURE_IMPROVEMENTS.md) | Open struggles, priorities and acceptance criteria. |
| [SBOM](SBOM.md) | Dependency artifacts, provenance, scope, licensing and regeneration. |
