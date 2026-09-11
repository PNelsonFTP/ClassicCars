# Implementation record

> The sections describing the initial build are historical. Version 1.1.0 supersedes their open engineering gaps; see the update below and [current improvement status](FUTURE_IMPROVEMENTS.md).

Initial build completed September 8, 2026 UTC (September 7 evening in Chicago); documentation/SBOM follow-up completed in the same session. This is a factual record of delivered work and observed struggles, not a Git commit history. Publication history after that initial local phase is recorded in [delivery status](docs/DELIVERY.md).

## Requirement interpretation and independence

The project began from [MuscleCarPrompt.md](MuscleCarPrompt.md). Work stayed within this separate car application: its own dependencies, Git initialization, database, migrations, configuration, raw evidence, browser storage, launchers, ports and Docker volume names. No boating inventory, credentials, notes or account sessions were imported.

The requested Next static frontend/Fastify local backend/Prisma SQLite architecture was retained. A generic hosted Sites starter was not substituted. No external repository, cloud backend, paid account, OS startup service or publishing destination was created. The user had not supplied an ORS key or external alert destination, so those features received explicit fallbacks and unverified-integration labels.

## Work completed by phase

| Phase | Concrete result | Evidence / location |
|---|---|---|
| Architecture and dependency selection | Next 16.3.4, React 19.2.8, Fastify 5.12.3, Prisma 7.10.0, Tailwind and accessible Radix controls; exact lockfile and separate local/static outputs | `package.json`, `package-lock.json`, `next.config.ts`, [decisions](DECISIONS.md) |
| Domain research | Verified classic model/generation boundaries, half-year wording, conservative historic identifiers, marketed Mustang-family ceiling of 2027, geocoder/routing policies and limitations | `config/reference-facts.json`, [reference research](docs/REFERENCE_RESEARCH.md) |
| Canonical data and shared search | Versioned Zod contracts, source ads versus groups, unknown values, specialty OR branch, common filters, strict routes, evidence basis and source-specific prices/history | `shared/`, `server/store.ts`, `tests/search.test.ts` |
| Workspace UI | Responsive warm neutral/sage layout, real ad images, grid/list/map, filters, shortlist/notes, six-ad comparison, saved searches/comparisons, imports, correction tools, source coverage, settings and theme | `app/`, `components/`, browser screenshots in ignored `test-results/` |
| Backend and persistence | Single-user authenticated API, session tokens, revisions, SQLite migrations, observation streams, reviewed merges, alerts, delivery attempts and local settings | `server/api.ts`, `prisma/`, `tests/backend.test.ts` |
| Source discovery | Evaluated 26 configured candidates across dealers, marketplaces, consignment, classifieds, forums, auctions and manual sources | [source coverage](SOURCE_COVERAGE.md), archived dealer/marketplace research |
| Initial real collection | 1,576 observed ads from nine sources; 51 initial detail responses investigated; later bounded production validations/enrichment | `data/research/` and `data/cache/` (private), `IngestRun`, [live data](LIVE_DATA.md) |
| Adapter implementation | Nine stable-ID parsers, configured queries/origins, supported pagination, detail isolation and source-specific price/status handling | `server/ingest/`, sanitized `tests/fixtures/` |
| Collection safety and operations | Bounded HTTPS/public-address fetches, DNS pinning, robots checks, private hashed cache, delays, renewable leases, source errors/caps and run reporting | `server/safe-fetch.ts`, `collector.ts`, `worker.ts` |
| Geography | Explicit city geocoding, Wheaton center cached, 20 bounded listing records processed, 16 current retained coordinate records, ORS abstraction and no-key path | `server/geography.ts`, `GeoCache`, routing tests |
| Private/public separation | Fictional development mode isolated; real snapshot redacted; Autotrader export exclusion; browser mode/path keys and connected session separation | `shared/sample.ts`, `store.ts`, UI persistence and tests |
| Launch and deployment artifacts | Setup, combined/separate commands, macOS/Windows launchers, VS Code tasks, optional Docker, manual Pages workflow, root/subpath static exports and backup command | `scripts/`, `.vscode/`, `.github/`, launchers, Docker files |
| Acceptance and visual checks | 52 portable tests, 10 desktop/mobile browser tests, root/subpath build and browser checks, fresh/repeated setup, port coexistence and export privacy scan | [validation](VALIDATION.md) |
| Documentation follow-up | README index, handoff, architecture/API reference, operations/restore guide, prioritized open-struggle register, this log, SBOMs, full lock/license inventory and advisory record | Root Markdown files, `docs/`, `scripts/generate-sbom.mjs` |

## Source work and interpretation

Initial ads by source were ClassicCars.com 1,387; Volo 50; GR Auto Gallery 44; American Dream Machines 34; Midwest Muscle Cars 3; North Shore Classics 12; J & S Motors 24; 500 Classic 3; Autotrader 19. Original research traversed 25 ClassicCars catalog pages and 22 other dealer/Autotrader pages in its configured scopes. Broad catalog discovery was followed by production smoke runs with smaller explicit caps; the two count types must not be conflated.

Seven adapters passed live production inventory parsing checks during this session. 500 Classic's later requests returned 403. Autotrader's initially successful public page later returned an unavailable template; its 19 original records remain local and are excluded from public export. Restricted forums/classifieds/auction sources were documented rather than scraped through restrictions. One genuine ClassicCars ad is labeled auction, but its phase, current bid and deadline remain unknown; no dedicated auction provider was integrated.

ClassicCars supported a 500-mile discovery option rather than the requested approximate 300-mile starting envelope, so discovery rounded outward. This is neither a route estimate nor a census. Dealer locations were kept separate from actual stock locations. Source catalogs and seller claims were never represented as independent mechanical/identity inspections.

The final static snapshot contains 1,557 real ad records, generated `2026-09-08T03:16:07.457Z`. Database/snapshot group counts currently equal ad counts. Crossposts have **not** been eliminated; the follow-up read-only audit quantified the weak-match problem in [future improvements](FUTURE_IMPROVEMENTS.md).

## Problems corrected during implementation

| Observed struggle | Implemented correction | Practical limit that remains |
|---|---|---|
| Production Turbopack CSS subprocess could not bind its internal socket | Use webpack for production, retaining separate `.next-dev` development output | Other target environments/compiler paths have not been validated |
| `tsx` CLI tried to create an IPC resource restricted in this environment | Use `node --import tsx` command contracts | Node/native-package target matrix still needs execution |
| Fresh Prisma migration encountered a nonexistent SQLite database | Precreate SQLite during setup before generate/migrate; rerun/fresh setup verified | Full cross-platform restore/migration matrix is future work |
| Prisma CLI transitive audit advisories | Apply recorded `deepmerge-ts`/`mysql2` overrides; audits then reported zero | Dated audits need renewal, and overrides should be reviewed after upstream updates |
| Generic challenge detection matched normal contact-form captcha scripts | Detect actual challenge-page markers instead; GR/ADM ordinary pages then parsed | Genuine blocks remain, and persistent cooldowns are still absent |
| Card/JSON metadata ordering and duplicated sparse cards could associate wrong values | Match stable source IDs and keep the richer duplicate within a run | Source layout drift still needs dated fixture updates |
| Financing, average price, savings and zero Shopify offers could look like asks | Isolate real ask fields; normalize zero placeholder to unknown; correct erroneous ask-history entry while retaining correction evidence | New sale formats/auction feeds need their own evidence contracts |
| Hidden generic dealer waitlist/modal text looked like sold/pending evidence | Scope status to the actual ad's card/detail data | Most ad availability remains a seller/source claim |
| Multi-column Midwest tables and ADM similar-car blocks confused specifications | Parse alternating cells and main-vehicle detail containers | Further condition/authenticity claims remain unverified |
| North Shore detail URL returned an empty shell | Reject shell enrichment; verify the site's documented permitted HTML detail endpoint and exact ID/ask/spec fields | Eleven initial target details remain from that scope |
| Sparse/new catalog data could erase a detailed ask or description | Preserve richer retained values and field-specific price observation time | More comprehensive per-field conflict/history UX is still needed |
| Older cached observations or refreshes could overwrite current facts/user reviews | Preserve newer canonical data, first-seen dates and durable reviewed identity/location overrides | Derived generation metadata and complex override interactions need deeper regression coverage |
| Capped route jobs repeatedly revisited fresh routes | Skip fresh routes and prove progress through a fake-provider test | Provider cache TTL still hardcodes 30 days; actual ORS is unverified |
| Detail caps could repeat the same first ads | Track detail attempt/observation times and rotate encountered candidates | Catalog pagination itself is not resumable across cycles |
| Backend snapshot and search/alerts applied staleness differently | Apply common read-time backend stale projection | Published snapshot availability remains frozen at export |
| Optional bid/deadline alerts could duplicate or lack opt-in | Add saved-search preferences, stable deadline IDs and quiet initial baseline tests | Cross-post/group-level duplication and real external delivery remain open |
| Imported map tooltip strings could be interpreted as HTML | Build tooltip DOM nodes with text content | Keep untrusted text handling covered during future map/UI changes |
| Connected reload, imports, mobile controls and workspace state needed persistence fixes | Session-scoped reload, browser-local imports, revision handling, responsive controls and browser tests | Actual external Pages connectivity and additional devices remain unverified |

## Verification performed

The detailed check record is [VALIDATION.md](VALIDATION.md). Besides automated predicates/API/parser/browser tests, the session verified actual source pages and pagination, inspected desktop/mobile visuals, ran both static build paths, checked search and real images with zero missing local assets/runtime errors, verified separate same-origin workspaces, scanned exported files for actual backend secret values and sample/private evidence fields, and checked fresh/repeated setup and backup creation.

The existing boating website on 3000 and MuscleScout on 3100/API 4410 returned 200 simultaneously. Shared-origin isolation used an isolated browser context and a synthetic other-app key. No BoatScout browser data was altered. The local API was restarted with final implementation code and the local worker started with external delivery disabled.

## Documentation-time findings and SBOM work

The follow-up audit inspected code and read the database without changing inventory. It measured weak duplicate suggestions, distinguished live parser failures from policy restrictions, and found remaining pagination, group-alert, geocoder-progress, route-cache and snapshot-aging gaps. These were recorded as future work rather than silently claimed fixed.

The installed npm graph produced CycloneDX 1.5 and SPDX 2.3 SBOMs, plus an `--omit=dev` subset. All 458 lock locations, dependency metadata, licenses and hashes were recorded separately. npm's lock-only exporter failed on four bundled optional-WASM edges; that limitation and the successful host-specific alternative are documented in [SBOM.md](SBOM.md). A new full read-only npm advisory query reported zero vulnerabilities. Regeneration is available through `npm run sbom` without package installation or app/data changes.

Research reports remain dated archives. Their initial feasibility/version proposals are preserved with pointers to current coverage, dependencies and the handoff. A successful past request does not imply a site is accessible today, and a generated snapshot/SBOM date does not imply a fresh source collection or vulnerability scan.

## Work deliberately left for an authorized next step

No site restriction was bypassed; no seller was contacted; no account cookies imported; no offers/bids/purchases made; no external alert sent; no ORS account/key obtained; and no public deployment or Git push performed. Windows/Docker/Node 24, public HTTPS backend connectivity and supported WebMCP integration were not executed on this host. Cross-listed duplicates, source blocks and the detailed engineering backlog remain explicit in [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md).


## Version 1.1.0 improvements and review handoff — September 8, 2026

The original nineteen-item backlog was implemented and audited. Durable checkpoints/detail queues, source health/cooldowns, shared budgets, fair geocoding/cache freshness, ranked duplicate review and replay, group-aware alerts, provenance/reset, dynamic aging, job/delivery controls, authorized feed contracts, specialty/auction/scope evidence, compact/lazy static catalogs, bounded UI pages, typed API modules, optional startup tooling, CI/pins, full SBOM validation and bundled archive inspection are now in the code. [The implementation map](docs/IMPROVEMENTS_STATUS.md) links every item to its modules/tests and remaining acceptance work.

State-integrity review corrected route preservation/invalidation, source-baseline/reset history, automatic grouping replay, permission expiry and obsolete exported detail chunks. Final review also corrected backend endpoint/token binding, serialized workspace revisions, revoked delivery consent and obsolete group-alert associations. Mobile operations tables now present each record with labels rather than clipping action columns.

A 50,000-ad synthetic benchmark passed sixteen shared search/alert membership scenarios; dictionary JSON reduced the full fixture bytes by 61.23%. Full-match memory/rescans and dense candidate buckets remain documented limits. Clean official Node 24 macOS and pinned Linux Docker release checks passed. Native Chromium WebMCP lifecycle checks ran without a polyfill. Four optional-WASM bundled package versions were directly observed; schema/hash validation and fresh audit succeeded.

Legacy operational queues were initialized offline from original observations. A bounded national ClassicCars check succeeded with three catalog pages/three details; the user's final catalog scan is recorded separately with current scope/counts. Site restrictions, pending enrichment and missing routing/delivery/feed credentials remain explicit. No challenge bypass, external message, OS service install or deployment occurred.

The initial delivery was committed locally as `4835c0a`. The user then requested local review before publication and the final improvement commit; all subsequent improvement changes remain uncommitted. GitHub Pages is retained alongside local and optional Docker workflows. Exact final validation and scan evidence are in [VALIDATION.md](VALIDATION.md) and [HANDOFF.md](HANDOFF.md).

The final catalog-only refresh completed at 17:23:23 UTC: 93 uncached pages, 3,139 retained ads and 3,120 public ads. It exhausted the accessible configured catalogs while preserving blocked sources and pending detail queues. A one-off report aggregation was rerun read-only to handle null vehicle locations; source results and inventory were unchanged. A new consistent private DB/environment backup was created after the scan.

Final export QA found one newly observed ClassicCars `$0 (OBO)` placeholder. The production and research parsers now normalize zero catalog asks to unknown; a new fixture covers negotiable/price-on-request behavior. The single canonical ad was corrected from cached evidence, its old zero ask was reclassified as a retracted parser observation, and a correction event retained the reason and original timestamp. No additional site request was made.

## Approved delivery and wind down — September 8, 2026

After reviewing the refreshed local website, the user approved the final commit, push and cleanup. [Delivery status](docs/DELIVERY.md) records the selected repository, actual remote checks/publication, and runtime shutdown. The prior review hold is satisfied; earlier entries remain historical records of what had happened at each stage. Private data, environment, evidence caches and backups remain outside Git.

## Inventory refresh and parser repairs — September 10, 2026

The web preview on 3100 and private API on 4410 were restarted for the requested refresh; the background worker remained off. A consistent private database/environment backup preceded collection. The [dated comparison](docs/validation/refresh-2026-09-10-comparison.md) records final counts, original observation dates, price/status changes, source health, quotas and remaining detail work.

Fresh source responses exposed three layout cases that were repaired and validated through the normal reviewed catalog-and-detail smoke process:

- North Shore ad 6144 had an empty narrative but exact identity, its own asking price and populated vehicle fields. The parser accepts that evidence while rejecting shells, wrong identities and insufficient fields.
- American Dream Machines ad 1516 omitted the catalog's `sold=Available` filter from its canonical URL. The parser permits only that observed filter difference, with the same HTTPS origin, full path and durable ad ID.
- GR Auto Gallery wrapped its specification pairs in nested elements and displayed stock `B6309 B` for URL ID `b6309-b`. The parser reads the own-vehicle specification/price container and accepts spacing only when an independent field names the exact requested vehicle URL. Financing and other-car prices remain excluded.

Additional data-flow corrections preserve earlier provenance dates for specification fields absent from a new response, propagate newly observed availability into the retained source baseline, and keep historical health failures out of the current error field after a successful recovery. Four affected run metadata rows were corrected under explicit guards; original failed runs, health history and a private correction receipt were preserved. No inventory failure or source restriction was erased.

The revised code passed 248 tests across 25 files and strict TypeScript checking. Fixtures were sanitized and cover identity rejection, price isolation, unavailable fields, sold/restocked transitions and recovery history. No package or lockfile changed. September 8 platform, browser-suite, Docker and advisory evidence remains separately dated.

A ClassicCars request timeout and later repeated DNS lookup failures triggered the persisted cooldown/review behavior. DNS resolution subsequently succeeded for ClassicCars and an independent dealer domain; a fresh permitted smoke check validated recovery. The catalog cycle opened by that check was completed before continuing details. Existing source delays and daily budgets were preserved throughout. No automatic worker, external notification, blocked-source bypass or new marketplace integration was enabled.

## Public GitHub delivery — September 10, 2026

The user explicitly authorized a new public repository, committing and pushing the project, and GitHub Pages hosting. Created [PNelsonFTP/ClassicCars](https://github.com/PNelsonFTP/ClassicCars) and attached it as `origin`. The existing static workflow uses `/ClassicCars`, while private runtime data remains ignored. Actual commit, remote validation and publication evidence are recorded in [delivery status](docs/DELIVERY.md).

The first deployment succeeded. Its live narrow-screen check exposed a clipped Save search button; the heading now allows shrinking and the mobile button's compact style takes precedence. Root and subpath exports rebuilt successfully, with the button inside the viewport at 1440, 390 and 375 pixels.

The first remote CI run passed Ubuntu/macOS Node 24, browser and container jobs but exposed two release-tool portability failures. The Windows smoke harness now converts the absolute TypeScript loader path to a file URL. SBOM generation now coalesces npm 10's repeated package/version identities only when non-location metadata agrees, preserving every install location and dependency edge. Conflicting identities and unresolved references remain fatal in generation and independent validation. Eleven regressions cover normalization; all 259 tests across 26 files, strict TypeScript, local isolated release smoke and existing SBOM validation passed. Exact Node 22.18.0/npm 10.9.3 and Node 24.20.0/npm 11.19.0 generation/schema/reference checks also passed locally. No dependencies or lockfile changed; the remote rerun supplies target-platform evidence.

The next Windows run passed release smoke and SBOM generation, then detected Git's automatic LF-to-CRLF conversion of the pinned SPDX schema. A narrow `.gitattributes` rule now preserves vendored schema bytes on every platform; the upstream hash checks remain unchanged.

Final [CI on `844e9cd`](https://github.com/PNelsonFTP/ClassicCars/actions/runs/34548198449) passed all six jobs, including 259 tests on each native target, Windows release/SBOM checks, 16 browser tests, both export paths and Linux x64 Docker. [Pages deployment](https://github.com/PNelsonFTP/ClassicCars/actions/runs/34547932246) and live desktop/mobile verification passed with 3,178 public ads. Updated README, handoff, acceptance register, SBOM and release documentation to reflect completed remote checks. Permanent aggregate receipts retain exact deployed/validated commits, public-data hashes and target artifact evidence; complete CI reports are privately archived. The closing documentation commit does not change the deployed application or inventory. Local web/API remain available and the collection worker remains off.
