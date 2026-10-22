# Project review and cleanup recommendations — October 20, 2026

**Historical review baseline; approved cleanup has since completed.** See the [cleanup results](CLEANUP_RESULTS_2026-10-20.md) for removals, retained backups, regenerated output and fresh verification. The findings and sizes below describe the pre-cleanup review.

At the initial review stage, nothing was deleted. Documentation was updated; application code, dependencies, private inventory, existing evidence and deployment output were preserved. No collection, dependency installation, build, commit, push or deployment was run. The current inventory remains the October 19 export.

The baseline is commit `6e11907`, with 353 tracked files and a clean initial worktree. The full recursive inventory includes hidden files, Git-ignored files, installed packages and Git internals: **38,757 regular-file paths, 3,019 directories and 28 symlinks**, with **zero enumeration errors**. Inventory sizes were captured before these documentation/audit outputs were added. A filesystem walk does not mean every line of third-party source received a manual correctness/security review.

The [candidate CSV](CLEANUP_CANDIDATES_2026-10-20.csv) is the complete per-candidate approval list: **228 entries**, each with exact path, logical bytes, allocated bytes, file count, confidence, reason, conditions and any required retained counterpart. Directory rows explicitly exclude separately counted metadata. The [machine-readable review](validation/project-review-2026-10-20.json) contains totals, baseline sizes and validation results. Private full inventory, reference analysis and backup-pair evidence are retained in ignored `data/reports/project-review-2026-10-20/`, with owner-only permissions; no environment values, private listing payloads or user settings are included in the tracked report/CSV.

## Recoverable space and approval choices

High means a disposable cache/metadata/empty scaffold with an identified regeneration path or no application consumer. Medium means reproducible output or a proven duplicate whose removal still requires consumer/recovery checks. Low means review-only: evidence may be unique, historically referenced or useful for future regressions. Low entries are **not recommendations to discard now**.

| Confidence | Candidate entries | Regular files covered | Logical bytes | Approximate size | Allocated bytes reported by filesystem |
|---|---:|---:|---:|---:|---:|
| High | 14 | 13 | 334,570 | 326.73 KiB | 364,544 |
| Medium | 32 | 1007 | 2,732,315,944 | 2.54 GiB | 2,772,303,872 |
| Low | 182 | 182 | 118,073,610 | 112.60 MiB | 118,517,760 |

The small, conservative High set is **334,570 bytes (326.73 KiB)**. Approving High plus the conditional Medium set would identify **2,732,650,514 bytes (2.54 GiB)** for possible removal. The additional Low pool is 118,073,610 bytes (112.60 MiB), subject to evidence/retention decisions; it is not included in that recommended ceiling. All categories together are 2,850,724,124 bytes (2.65 GiB), a review ceiling rather than promised free space.

These totals do not overlap. Directory entries include their children once, with the separately listed `out/.DS_Store` and `out-subpath/.DS_Store` excluded. Logical sizes, allocation, hard links and APFS shared extents/snapshots differ; filesystem allocation is not a guarantee of physical space returned. The baseline path sum is 7,654,235,216 bytes (7.13 GiB); it counts two esbuild hard-link paths separately. That dependency is retained, so it does not affect candidate totals. Empty-directory metadata is not credited as recoverable file content.

Approve categories or exact CSV paths after reviewing the conditions. Do not apply a recursive deletion to all `data/`, `backups/`, `test-results/`, `.git/` or `node_modules/` based on this report. A later cleanup must recheck changed files and active consumers.

## Current implementation and interactions

MuscleScout 1.1.0 is a single-user classic-car workspace for Mustang, Camaro and Corvette ads, with selected specialty branches. It has two independently useful paths:

- **GitHub Pages/static:** Next App Router builds HTML/CSS/JS, with browser-local favorites, notes, searches and imports. The browser fetches the dictionary-packed catalog, falls back to the full public snapshot, and lazily resolves an exact ad from the catalog's detail-file map. Pages cannot run SQLite, collection, routing or scheduled alerts.
- **Connected/local:** Fastify authenticates a private password into expiring bearer sessions; Prisma/better-sqlite3 stores canonical source ads, observations, workspace state and operations. A separately started worker processes jobs/schedules and opted-in alerts. The CLI can operate directly without the worker.

| Area | Files and actual responsibility |
|---|---|
| Frontend | `app/page.tsx`, `layout.tsx`, `globals.css`, `components/MuscleScout.tsx` and seven supporting components. Map, sample records and selected services are dynamically imported; they are not dead code. |
| Shared behavior | Twelve modules under `shared/`: Zod contracts, canonical predicates/grouping/freshness, compact transport, duplicate evidence, reviews, API client, serialized workspace saves, optional WebMCP and seven clearly fictional samples. |
| Backend | `server/api.ts`, `collection-api.ts`, `store.ts`, `db.ts`, `search-page*.ts`, `reviews.ts`, `grouping.ts`, `alerts.ts`, `delivery-policy.ts`, `geography.ts`, `service-budget.ts`, `safe-fetch.ts`, `index.ts`, `worker.ts`. |
| Collection | `server/ingest/` contains deterministic source parsers, normalization, jobs/checkpoints, independent detail queues, classified failures, authorization-aware feeds, scope checks, bootstrap and a bounded eBay library adapter. |
| Configuration | `config/sources.json` has 26 source definitions, permitted origins/methods and query scopes. Reference facts/manufacturer evidence/discovery plans are documentation and provider-integration inputs; absence of a runtime import does not make them obsolete. The feed example is an intentionally empty template. |
| Persistence | `prisma/schema.prisma`, two ordered migrations and `prisma.config.ts`. Eleven application tables plus migration metadata. New operational state lives in namespaced JSON `Setting` rows. Never reset the database to apply pending migrations. |
| Local/deployment entry points | `scripts/setup.ts`, `dev.ts`, `serve.ts`, the two platform launchers, `.vscode/tasks.json`, optional generated login-service plans, `Dockerfile`, `compose.yaml` and the two GitHub workflows. |
| Verification | 27 unit-test files plus Playwright desktop/mobile E2E and sanitized HTML/JSON fixtures. Dedicated release, source-access, scope, privacy/export, geography/delivery readiness, scale and SBOM tools cover other boundaries. |
| Documentation | Root README/handoff/implementation/future-work/data/source/validation/SBOM/decisions documents, detailed `docs/` runbooks/research, dated `docs/validation/` receipts, and portable target-specific `docs/sbom/` inventories/schemas. Historical dates remain meaningful. |

Data flows from permitted HTTPS pages or authorized imports through normalization and evidence-preserving upserts into SQLite. Collection uses resumable source/scope/query checkpoints and source-wide detail tasks; shared persistent budgets coordinate CLI/API/worker. Failed pages do not imply a sale. Reviewed grouping preserves source-ad identities; group counts do not authenticate unique physical cars. Geography and external delivery need explicit configuration and separate consent/readiness. Public export removes private provenance/contact/workspace information and reevaluates feed publication rights.

The local database contains **4,578 listings, 77,684 observations, 222 ingest runs, 178 settings, seven geography-cache records and one workspace**. There are zero leases, saved searches, alerts, delivery attempts or group reviews at the audit snapshot; these counts do not establish process absence. `snapshot.json` contains **4,559 ads / 4,539 groups**, generated `2026-10-19T13:07:59.363Z`. All **46** public detail chunks match their content hashes and catalog membership; all 4,559 ads resolve, with **no missing or orphan public chunks**. The full snapshot is an intentional fallback/compatibility transport, not an unnecessary duplicate.

### Runtime, dependencies and build conventions

`package.json` declares Node `>=22.18.0`; Node 24 is the documented release/CI target. The current local host is Node **26.7.0**, npm **11.19.0**. All installed direct dependency versions match their lock locations; no local `file:`/linked package dependencies or version mismatches were found. The lock contains **471** dependency installation locations; the host SBOM has **368 dependency identities plus the application**, and the runtime graph has **128 plus the application**. Platform-optional/transitive packages, Prisma generation, binaries, CSS imports and build tools must not be pruned by searching only application imports.

The 19 direct runtime/build declarations cover Next/React, Fastify/CORS/rate limits, Prisma/native SQLite, Radix UI, Tailwind/PostCSS, Cheerio, dotenv, Leaflet, Lucide, Nodemailer, robots parsing and Zod. The 14 development declarations cover Playwright, type packages, AJV/schema formats, Prettier, Prisma CLI, tsx, TypeScript and Vitest. Exact installed versions are listed below. `tsx` is required by runtime npm commands despite its development classification, and the current Dockerfile intentionally runs full `npm ci`; blindly using `--omit=dev` would break those commands. No dependency was removed or upgraded.

The bundled Next static-export guide was read as required by `AGENTS.md`. `next.config.ts` uses `output: 'export'`, trailing slashes, unoptimized images and a normalized public base path; development uses `.next-dev`, production `.next`. Production scripts select webpack. `build:exports` builds both `/` and `/ClassicCars`, retaining root output in `out/` and project-path output in `out-subpath/`. They contain shared inventory but different paths/bundles and are not interchangeable copies. `next-env.d.ts` imports generated `.next/types` files; after removing `.next`, rebuild before expecting standalone typechecking to work.

GitHub CI runs Node 24 on Ubuntu/Windows/macOS, Node 22.18 on Ubuntu, a browser job and a container job. Actions and the Docker base use immutable references; apt/hosted runners still vary. Pages is **manual `workflow_dispatch`**, default base `/ClassicCars`: it installs, typechecks, tests, builds the committed public data and deploys `out/`. A push alone neither refreshes data nor publishes Pages. The latest recorded live receipt is October 19; this review made no network requests or new claim of live website verification. Docker Compose shares a named database volume between API/worker; its web service has build-time public data. Public Pages requires no Docker.

Private `.env` is required for local credentials/settings; `.env.example` is the public names/defaults template. Database/settings and browser storage are independent; the browser store is outside this directory. `.gitignore` protects dependencies, environments, `.next*`, `out*`, `data/*` except `.gitkeep`, backups, caches/logs, test output, generated services and TypeScript cache. `.dockerignore` also excludes private/generated directories from build context. `.gitattributes` preserves vendored SBOM schema bytes on Windows. `CLAUDE.md` points to `AGENTS.md`; both remain purposeful.

### Installed direct dependency versions

| Dependency | Declared scope | Installed / locked version |
|---|---|---|
| `@fastify/cors` | runtime/build | 11.3.0 |
| `@fastify/rate-limit` | runtime/build | 10.3.0 |
| `@prisma/adapter-better-sqlite3` | runtime/build | 7.10.0 |
| `@prisma/client` | runtime/build | 7.10.0 |
| `@radix-ui/react-dialog` | runtime/build | 1.1.23 |
| `@radix-ui/react-switch` | runtime/build | 1.3.7 |
| `@tailwindcss/postcss` | runtime/build | 4.3.3 |
| `cheerio` | runtime/build | 1.2.0 |
| `dotenv` | runtime/build | 17.4.2 |
| `fastify` | runtime/build | 5.12.3 |
| `leaflet` | runtime/build | 1.9.4 |
| `lucide-react` | runtime/build | 0.577.0 |
| `next` | runtime/build | 16.3.4 |
| `nodemailer` | runtime/build | 10.0.1 |
| `react` | runtime/build | 19.2.8 |
| `react-dom` | runtime/build | 19.2.8 |
| `robots-parser` | runtime/build | 3.0.1 |
| `tailwindcss` | runtime/build | 4.3.3 |
| `zod` | runtime/build | 4.5.4 |
| `@playwright/test` | development/tooling | 1.63.0 |
| `@types/leaflet` | development/tooling | 1.9.22 |
| `@types/node` | development/tooling | 22.20.1 |
| `@types/nodemailer` | development/tooling | 8.0.1 |
| `@types/react` | development/tooling | 19.2.18 |
| `@types/react-dom` | development/tooling | 19.2.7 |
| `ajv` | development/tooling | 8.20.0 |
| `ajv-formats` | development/tooling | 3.0.1 |
| `ajv-formats-draft2019` | development/tooling | 1.6.1 |
| `prettier` | development/tooling | 3.9.6 |
| `prisma` | development/tooling | 7.10.0 |
| `tsx` | development/tooling | 4.23.13 |
| `typescript` | development/tooling | 5.9.3 |
| `vitest` | development/tooling | 4.1.11 |

### Complete npm command index

Commands run from the project root. This index describes current side effects; it is not a request to execute them during cleanup.

| Script | Entry point / action |
|---|---|
| `setup` | `node --import tsx scripts/setup.ts` — Create/preserve private environment, generate Prisma and apply pending migrations/defaults. |
| `dev` | `node --import tsx scripts/dev.ts` — Start frontend, API and worker after checking configured ports. |
| `dev:web` | `next dev --hostname 127.0.0.1 -p 3100` — Next dev frontend only, loopback port 3100. |
| `api` | `node --import tsx server/index.ts` — Start authenticated Fastify API; reads private DB/environment. |
| `worker` | `node --import tsx server/worker.ts` — Process durable jobs, collection schedule and opted-in delivery. |
| `collect` | `node --import tsx scripts/cli.ts collect` — Collect permitted sources through CLI; changes DB, queue/budget state and evidence. |
| `geocode:listings` | `node --import tsx scripts/cli.ts geocode` — Explicit geocoding batch; may call configured provider and update DB. |
| `route:listings` | `node --import tsx scripts/cli.ts route` — Explicit road-route batch; credentials needed; may call ORS and update DB. |
| `export:snapshot` | `node --import tsx scripts/cli.ts snapshot` — Write redacted public snapshot/catalog/details and prune superseded exporter-owned chunks. |
| `import:listings` | `node --import tsx scripts/cli.ts import` — Import canonical listing JSON into private DB. |
| `config` | `node --import tsx scripts/cli.ts config` — Read settings or validate/apply an entire settings object; `--dry-run` avoids applying. |
| `backup` | `node --import tsx scripts/cli.ts backup` — SQLite VACUUM INTO plus corresponding private environment copy; excludes raw evidence/browser state. |
| `build` | `next build --webpack` — Webpack Next static export for current base path; replaces generated output. |
| `serve` | `node --import tsx scripts/serve.ts` — Serve selected static directory (`out` by default); no API or worker. |
| `typecheck` | `tsc --noEmit` — TypeScript noEmit; default incremental mode writes tsbuildinfo. |
| `test` | `vitest run` — Vitest regression suite; tests use isolated stores/transports where configured. |
| `test:e2e` | `playwright test` — Playwright desktop/mobile; dev frontend and temporary API 4411; writes screenshots/results. |
| `db:generate` | `prisma generate` — Generate Prisma client under installed dependency runtime. |
| `postinstall` | `prisma generate` — Generate Prisma client after dependency installation. |
| `verify:exports` | `node --import tsx scripts/verify-exports.ts` — Browser-check both root/subpath builds on temporary port 3160; writes result/screenshots. |
| `sbom` | `node scripts/generate-sbom.mjs` — Offline installed/lock graph, licenses and manifest generation; overwrites tracked reports. |
| `import:feed` | `node --import tsx scripts/import-feed.ts` — Validate an authorized feed; changes DB only with `--apply`. |
| `test:release` | `node scripts/release-smoke.mjs` — Isolated setup/migrations/native SQLite/backup/API smoke using temporary state and port 4418. |
| `build:exports` | `node scripts/build-exports.mjs` — Build root and /ClassicCars outputs, restoring root to out. |
| `sbom:validate` | `node scripts/validate-sbom.mjs` — Read-only pinned schema, input/report hash and graph validation. |
| `sbom:artifacts` | `node scripts/sbom-artifacts.mjs` — Hash installed native/WASM files, inventory dpkg if present, update artifact report/manifest. |
| `sbom:compare` | `node scripts/compare-sbom.mjs` — Compare lock inventories; writes test-results/sbom-diff.json by default. |
| `coverage:report` | `node --import tsx scripts/generate-scope-report.ts` — Offline configured-scope/checkpoint report; optional output base writes JSON and Markdown. |
| `service` | `node scripts/local-service.mjs` — Generate/install/uninstall optional login-service configuration; even generate writes plans. |
| `verify:browser-context` | `node scripts/diagnose-browser-context.mjs` — Browser diagnostics; writes capability report. |
| `verify:release-config` | `node scripts/validate-release-config.mjs` — Read-only check of pinned Actions and Docker base references. |
| `benchmark:scale` | `node --expose-gc --import tsx scripts/benchmark-scale.ts` — 50,000-row synthetic parity/performance benchmark; writes a report. |
| `sbom:bundled` | `node scripts/inspect-bundled.mjs` — Inspect an explicitly supplied locked package archive; writes bundled-artifact evidence. |
| `operations:bootstrap` | `node --import tsx scripts/bootstrap-operations.ts` — Fill missing operations queues/health from retained local evidence, offline. |
| `verify:routing` | `node --import tsx scripts/verify-routing.ts` — Readiness by default; explicit authorized live test can call ORS and write receipt. |
| `verify:delivery` | `node --import tsx scripts/verify-delivery.ts` — Readiness by default; explicit opted-in send-test can deliver one synthetic digest. |
| `sources:audit` | `node --import tsx scripts/audit-sources.ts` — Deterministic permitted access audit; live requests and private report/health updates. |
| `sources:browser-check` | `node --import tsx scripts/source-browser-check.mjs` — Explicit Chromium source diagnostic; live navigation and private evidence. |
| `sources:feed-template` | `node --import tsx scripts/source-feed-template.ts` — Generate incomplete private feed template; does not grant permission. |

Additional scripts are deliberately indirect: `collection-cli-options.ts` is shared CLI parsing; `normalize-sbom.mjs` supports generation/validation; `verification-report.ts` writes private geography/delivery receipts; `e2e-api.ts` is Playwright's isolated backend. `import-research.ts` is a historical, hard-coded import path for the ignored dealer/marketplace captures. It is not a routine refresh command: it writes DB/run state and exports immediately with no dry run. Retain it and its research inputs unless a maintainer explicitly retires reproducible historical import support. The eBay adapter is a tested library awaiting an authorized caller, not an enabled collector/CLI.

## High-confidence candidates

The CSV lists all paths individually, including Finder metadata inside ignored dependency/build folders and `.git/.DS_Store`. Only that Finder file is proposed inside `.git`; repository objects, refs, index, logs and hooks are retained.

| Path | Bytes | Why removable / verified consumer |
|---|---:|---|
| `.DS_Store` | 10,244 | Finder folder view metadata; no application/build/test input |
| `.git/.DS_Store` | 6,148 | Finder folder view metadata; no application/build/test input |
| `data/.DS_Store` | 6,148 | Finder folder view metadata; no application/build/test input |
| `docs/.DS_Store` | 6,148 | Finder folder view metadata; no application/build/test input |
| `lib/` | 0 | Empty untracked directory; no imports or configured directory consumer found |
| `node_modules/.DS_Store` | 51,204 | Finder folder view metadata; no application/build/test input |
| `node_modules/next/.DS_Store` | 6,148 | Finder folder view metadata; no application/build/test input |
| `node_modules/next/dist/.DS_Store` | 6,148 | Finder folder view metadata; no application/build/test input |
| `out-subpath/.DS_Store` | 6,148 | Finder folder view metadata; no application/build/test input |
| `out/.DS_Store` | 6,148 | Finder folder view metadata; no application/build/test input |
| `public/.DS_Store` | 6,148 | Finder folder view metadata; no application/build/test input |
| `test-results/.last-run.json` | 45 | Playwright last-run status; not a test fixture |
| `tests/.DS_Store` | 6,148 | Finder folder view metadata; no application/build/test input |
| `tsconfig.tsbuildinfo` | 217,745 | Incremental TypeScript cache; tsc rebuilds it |

`tsconfig.tsbuildinfo` regenerates on an incremental typecheck. The review used `--incremental false`, so it did not alter that cache. Playwright last-run state can affect `--last-failed` selection, but is not application state. `lib/` is empty and untracked, with no project import/config consumer found; removing it saves no credited file bytes. `.DS_Store` is not an application asset; its copy under `public/` currently propagates into static outputs. These small files were left in place for approval.

## Medium-confidence candidates

### Four reproducible output directories

| Path | Logical bytes, excluding separately listed metadata | Regeneration / condition |
|---|---:|---|
| `.next-dev/` | 150,010,832 | Verify no process/external consumer; rebuild before serving; .next deletion also requires build to restore next-env type imports |
| `.next/` | 160,850,014 | Verify no process/external consumer; rebuild before serving; .next deletion also requires build to restore next-env type imports |
| `out-subpath/` | 43,383,582 | Verify no process/external consumer; rebuild before serving; .next deletion also requires build to restore next-env type imports |
| `out/` | 43,382,472 | Verify no process/external consumer; rebuild before serving; .next deletion also requires build to restore next-env type imports |

`serve.ts`, `verify-exports.ts`, build scripts, Docker and environment-selected static directories are real consumers. No TCP listeners were visible on 3100/4410 during the review; that does not exclude a worker, dev process on another port, open build or a consumer in another checkout. Confirm before removal. `npm run build:exports` recreates both static exports; the next dev/build recreates its own Next state. Cleanup should not be coupled to an unrequested collection or publication.

### Fourteen exact duplicate database/environment recovery pairs

**2,334,689,044 bytes (2.17 GiB)** are duplicated recovery-pair content. Every candidate DB was SHA-256 matched to its named retained DB; each retained database passed read-only SQLite `quick_check`. Both environment files in each pair are identical; all 31 backup environment files also match the current environment. No credential values or environment hashes are published. The latest October 19 post-refresh pair is protected and is not a candidate.

These remain Medium because an extra recovery copy and its date/path can serve a purpose even with identical bytes. Approve retiring the named copy as a pair, retain the other pair, and preserve any dated receipt provenance before removing it. Disk co-location is not an independent disaster-recovery backup.

The table lists DB paths; **each corresponding `.env` path is a separate 422-byte CSV row** and is part of the same approval decision.

| Candidate DB path | DB bytes | Required retained DB path |
|---|---:|---|
| `backups/musclescout-2026-09-08T15-50-01-903Z.db` | 10,149,888 | `backups/musclescout-2026-09-08T03-18-53-092Z.db` |
| `backups/musclescout-2026-09-10T20-09-18-602Z.db` | 42,315,776 | `backups/musclescout-2026-09-08T17-29-49-526Z.db` |
| `backups/musclescout-2026-09-12T12-03-45-494Z.db` | 86,155,264 | `backups/musclescout-2026-09-10T23-06-01-089Z.db` |
| `backups/musclescout-2026-09-12T21-50-42-509Z.db` | 107,671,552 | `backups/musclescout-2026-09-12T12-40-08-380Z.db` |
| `backups/musclescout-2026-09-24T12-12-08-563Z.db` | 107,757,568 | `backups/musclescout-2026-09-12T21-55-02-977Z.db` |
| `backups/musclescout-2026-09-27T20-04-57-044Z.db` | 132,714,496 | `backups/musclescout-2026-09-24T13-01-44-858Z.db` |
| `backups/musclescout-2026-09-29T23-02-01-081Z.db` | 154,685,440 | `backups/musclescout-2026-09-27T20-45-02-890Z.db` |
| `backups/musclescout-2026-10-01T10-49-07-000Z.db` | 176,566,272 | `backups/musclescout-2026-09-29T23-42-46-277Z.db` |
| `backups/musclescout-2026-10-04T12-42-28-136Z.db` | 198,340,608 | `backups/musclescout-2026-10-01T11-30-19-226Z.db` |
| `backups/musclescout-2026-10-05T12-13-58-235Z.db` | 220,672,000 | `backups/musclescout-2026-10-04T13-24-17-136Z.db` |
| `backups/musclescout-2026-10-09T13-44-13-917Z.db` | 240,332,800 | `backups/musclescout-2026-10-05T12-26-21-919Z.db` |
| `backups/musclescout-2026-10-13T12-25-54-717Z.db` | 263,360,512 | `backups/musclescout-2026-10-09T14-27-34-563Z.db` |
| `backups/musclescout-2026-10-17T11-42-50-345Z.db` | 285,581,312 | `backups/musclescout-2026-10-13T13-10-18-987Z.db` |
| `backups/musclescout-2026-10-19T12-23-05-679Z.db` | 308,379,648 | `backups/musclescout-2026-10-17T12-27-46-396Z.db` |

No distinct historical database state is proposed for automatic deletion. There are 31 database/environment pairs representing 17 byte-distinct database states. A time-based retention policy should be a separate decision, after an independent recovery copy and evidence coverage are established.

## Low-confidence candidates — retain pending review

Every individual file in these sets appears in the CSV, with exact bytes and its review condition. These sets were frozen from the initial inventory; the new private audit directory is not part of the old-report candidate set.

| Set / path | Files | Logical bytes | Finding and reason not to discard yet |
|---|---:|---:|---|
| 32 individually named `data/cache/<sha256>.html` bodies | 32 | 8,173,032 | No current DB/table text hash, cache-index hash or scanned local text reference found. Historical database backups were not exhaustively scanned for raw-evidence references. Keep until that graph and retention requirements are resolved. |
| Individually listed historical `data/reports/` files | 113 | 101,261,918 | Before-state JSON, raw collection output, logs, CI/deployment receipts and debug output. Tracked comparisons summarize them, but do not replace all original details. Largest five before-state files account for 91,976,856 bytes. Archive/verify reproducibility before selecting any for removal. |
| Individually listed `test-results/` files, excluding last-run cache | 30 | 8,632,156 | Generated screenshots and browser/export reports. Some screenshots are the only local visual evidence for a dated receipt; JSON summaries are not pixel-identical replacements. Decide historical evidence retention. |
| `generated/local-service/` files | 4 | 2,561 | Generated startup plans embed this checkout and a Node executable. No matching macOS LaunchAgent file was found, but copies/manual OS registration were not ruled out. Keep until usage is checked or deliberately regenerate. |
| `tests/fixtures/admcars-detail-1812.html` | 1 | 1,337 | No current caller found; distinct captured vehicle evidence may still be useful for future regression coverage. |
| `tests/fixtures/admcars-detail-1814.html` | 1 | 1,298 | Same uncertainty; not considered redundant merely because other ADM fixtures exist. |
| `tests/fixtures/admcars-detail-1821.html` | 1 | 1,308 | Same uncertainty. Git history was checked; no test/scripts directory-discovery consumer found. |

The 32 cache bodies are only 0.98% of cached HTML bytes. The other 4,537 bodies were found through current DB/cache/local-text hashes and are protected by this analysis. All **1,791 current cache indices** resolve to existing bodies. Many superseded bodies remain in `Observation` history: cache-index replacement alone is insufficient evidence of garbage. References can be bare hashes, nested JSON, research paths or importer-generated `#sha256:` references. The scan intentionally over-retains any hash found anywhere in current database text.

Fixture verification checked literal names, extensionless stems, numeric ID templates and directory reads. In particular, Midwest card/detail fixtures are loaded through interpolated IDs and are retained despite missing full literal filenames. The three ADM candidates are not loaded by those current patterns. Tests were not modified to make any fixture appear unused.

## Files explicitly retained and duplicate false positives

| Path / family | Baseline logical size | Why retained |
|---|---:|---|
| `node_modules/` | 812,203,230 | Installed runtime/build/test/native/codegen dependencies; 28 intact internal .bin symlinks. Do not manually remove optional/transitive packages. Two esbuild paths are the same hard-linked executable, not duplicate disk content. |
| `.git/` | 18,093,963 | Repository history, object graph, refs/index and reflogs are recovery/version-control state. Excludes only the individually listed Finder metadata candidate. |
| `public/` | 41,967,373 | 48 current public data files plus .nojekyll and Finder metadata; catalog fallback and all 46 lazy detail chunks have proven consumers. Excludes only Finder metadata candidate. |
| `data/` | 1,312,049,103 | Private DB, source observations, evidence, authorized-feed setup and report history. Most cache bodies have proven references; only explicitly listed evidence/report files are review candidates. |
| `backups/` | 5,057,369,194 | Latest recovery pair, distinct point-in-time DBs, release archive and private prepublication Git history. Only the named 14 identical pairs are conditional candidates. |

- `backups/musclescout-2026-10-19T13-08-08-571Z.{db,env}` is the newest pair. Its database passes `quick_check` and matches current listing/observation counts; this is an integrity/count check, not a full restore drill or proof that every setting matches. Backup databases are compact `VACUUM INTO` copies, so different physical size from the active DB is expected.
- `backups/github-release-34548198449.tar.gz` (2,626,274 bytes) contains 340 archive entries and retains platform/CI/SBOM evidence whose hosted artifact retention was limited. It is not a disposable download duplicate. The tar member list was inspected without extracting or executing it.
- `backups/musclescout-prepublication-2026-09-10.bundle` (2,813,550 bytes) verifies as a complete Git bundle with four refs. It preserves earlier private history that the public equivalents intentionally excluded. Keep it private and independent of a normal public push.
- `.env`, `.env.example`, `data/.gitkeep`, `public/.nojekyll`, both migrations, `next-env.d.ts`, lockfile, editor tasks, launchers, source access/discovery plans and historical prompt/baseline are purposeful. SQLite WAL/SHM files were not present at inventory time; future live sidecars must never be treated as temporary junk.
- Duplicate SBOM schemas, empty audit reports and bundled-artifact reports in host/target folders provide self-contained target evidence and pinned validation bytes. Identical content does not make a target folder obsolete.
- Identical robots/page captures across `data/research/` and `data/cache/` preserve separate dated capture paths and import/observation provenance. The duplicate comparison found 63 same-content groups across the scoped files, including 14 DB pairs and environments; it does not license deleting all but one path.
- Research normalized/cumulative/detail-subset JSON files serve original import and research-audit roles. `scripts/import-research.ts` directly reads dealer observed-listings and marketplace all-inventory; the detail subset and older normalized export are documented research evidence. Keep or explicitly retire this workflow together.
- `logs/` is empty but is the generated service's stdout/stderr destination. Empty generated Next directories and `node_modules/.vite-temp` are runtime scaffolding, not useful space-saving targets. No root `cache/`, `playwright-report/`, nested Git repositories, `.bak`, `.old`, `.orig`, `.rej`, editor swap or obvious copy-suffixed owned files were found. Absence applies to this scan only.

## Verification method and limits

The walk used `lstat` and did not follow directory symlinks. All 28 symlinks resolve inside this checkout and none is broken. File sizes, allocation, timestamps, inode and link counts were recorded. Same-size files outside vendor/build/Git internals were SHA-256 compared to identify exact duplicates; unlike a blanket duplicate purge, ownership, provenance and target portability were considered. Package metadata, lock/SBOM inputs, direct imports, dynamic imports, string-based runtime paths, CSS, configured scripts, workflows, tests, fixture templates and relevant Git history were checked.

All current SQLite tables were read through a read-only connection for hash/path references. Current cache-index JSON and owned/private textual evidence were cross-checked. Database backups were read-only checked for duplicate integrity; their entire historical reference graphs were not scanned. No raw source requests were made. Protected evidence may still reference externally archived files or browser state outside this directory.

Immediate sibling-project package/Compose/pyproject/editor configurations were checked for explicit relative/absolute consumers of this checkout; none was found. This is a bounded dependency check, not a scan of every file on the computer or a proof that no external project/manual script consumes these paths. No package-local external links were found. No file existed at the expected macOS user LaunchAgent path; other loaded/manual registrations remain unverified. No visible TCP listeners on 3100/4410 were returned by `lsof`; no process was stopped.

Checks executed during this review:

| Check | Result |
|---|---|
| Strict TypeScript | `tsc --noEmit --incremental false` passed; no tsbuildinfo write. |
| Owned JavaScript syntax | 14 `.mjs` files passed `node --check`. |
| Supply-chain schemas/hashes | All three SBOM schemas and five current manifest report hashes/input hashes passed offline. |
| Native artifact comparison | All 31 host native/WASM file hashes match the retained September 8 artifact report; this independent comparison does not add them to the current host manifest. |
| Release configuration | All 13 workflow action references and Docker base digest passed pinned-reference checks. |
| SQLite integrity | Active DB, latest backup, all 14 duplicate keepers: `quick_check = ok`. |
| Public lazy transport | 4,559 ads resolve across 46 content-hash chunks; no missing/orphan chunks or membership/hash errors. |
| Local documentation links | 44 Markdown files checked after updates; zero missing local file links. |
| Review accounting | CSV bytes/file counts/confidence totals reconciled; no double-counted candidate paths. |

No full test suite, browser run, new integration acceptance, build, source refresh, advisory query or remote deployment verification was performed. Those actions would produce or replace files under review; no application code changed. The **276 tests / 27 files** and live site behavior remain dated October 19 release evidence, not newly executed results.

## Documentation corrections and remaining engineering work

README/handoff now point to the October 19 inventory rather than presenting September 12 totals as the current summary. Session-specific process claims have been qualified. Operations now records executed Windows/remote CI and public Pages, while retaining separate interactive Windows startup and private-backend connectivity acceptance. CLI zero-cap behavior and manual Pages dispatch are explicit. Architecture/README now expose the lifetime-attempt detail retry limitation. Future improvements now includes the retention and SBOM-chain follow-ups. The SBOM guide corrects the current SPDX relationship count (**644**) and host manifest scope (**five reports**, not seven), without redating advisory/native evidence. Historical refresh/research receipts remain intact.

Engineering observations were documented, not changed as cleanup:

1. **Detail retry accounting:** successful checks increment lifetime attempts; `failDetail` blocks when the previous lifetime count is at least two. A first later transient failure can block an older healthy task. Implement consecutive-failure accounting and audited targeted recovery in a separate code change; do not erase queues to resolve it.
2. **SBOM manifest chain:** September 12 host regeneration lists five main/license reports and omits hashes for the retained native/bundled reports. Current validation passes the five it declares. Regenerate artifact evidence and validate the complete chain deliberately for the next release; the independent 31-file comparison above is not a manifest repair.
3. **Retention policy:** consistent backups currently have no age/count/content retention policy, producing repeated byte-identical pairs. Decide independent recovery, evidence and release-archive retention before automating rotation. Archive manifests should preserve original dates, retained counterpart identities and original evidence paths.
4. **Unconsumed fixture intent:** review the three ADM captures for useful new regression assertions or intentional archival/retirement. Do not add tests that merely read a file to justify keeping it.
5. **Module/dependency boundaries:** the large client workspace remains functional but concentrates state/rendering concerns. `domhandler` is used for a type through Cheerio's transitive installation; stricter future package managers may require an explicit type dependency or a Cheerio-exposed type. The eBay library still needs authorized integration/budget/checkpoint ownership before live use. None is a safe automatic file deletion.
6. **Existing product/data limits:** cross-listed ads can remain unresolved; ClassicCars detail backlog, dealer 404s and restricted/disabled source access remain open. Fresh routes, licensed feeds and opted-in live SMTP/webhook acceptance require actual configured access. Removing evidence or changing a browser identity does not solve those gaps. See [future improvements](../FUTURE_IMPROVEMENTS.md), [source access](SOURCE_ACCESS.md) and [October 19 coverage](validation/refresh-2026-10-19-comparison.md).

The initial review left cleanup pending approval. The user subsequently approved High/Medium cleanup, now recorded in the [cleanup results](CLEANUP_RESULTS_2026-10-20.md). Low candidates remain untouched. Documentation/audit files remain uncommitted for review.
