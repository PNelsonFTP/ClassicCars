# MuscleScout handoff — 1.1.0

Final [CI run](https://github.com/PNelsonFTP/ClassicCars/actions/runs/34721449243) passed all six jobs on application/data commit `a639985`: Node 24 on Ubuntu, macOS and Windows; Node 22.18 on Ubuntu; hosted browser checks; and Docker.

Final source-access site deployment: [`a639985`](https://github.com/PNelsonFTP/ClassicCars/commit/a6399850962290fbd3224d0bf2010e2a0d10a433), [successful Pages run](https://github.com/PNelsonFTP/ClassicCars/actions/runs/34721449077), and [live verification](docs/validation/source-access-pages-2026-09-12.json). Exact catalog/snapshot/detail hashes match the local public export; 1440/390/375-width checks and all 26 source methods passed. No collection runs or leases remain active.

## September 12 source-access improvement

The [access audit and operating guide](docs/SOURCE_ACCESS.md) replaces blanket “AI blocked” labels with dated methods, evidence and next steps for all 26 sources. Fixed robots user-agent matching and JWS content negotiation, added catalog-only collection, deterministic HTTP/Chromium diagnostics, and incomplete private feed templates for every configured source. The new JWS scan found 44 advertised vehicles and eight matching classics, **all explicitly sold**; it added no active stock or known asking prices. Current totals are **3,284 retained ads / 3,262 groups**, **3,265 public ads / 3,249 public groups**. This access audit does not redate the earlier inventory refresh.

403 responses remain for Duffy’s, 500 Classic and Classics on Autotrader in HTTP/Chromium tests. Autotrader still serves an unavailable template. Forum, auction and other provider restrictions, missing eBay access, unresolved cross-listings, the ClassicCars detail backlog and J & S 404s remain documented. No new dependencies or credentials were added. [Machine-readable access evidence](docs/validation/source-access-2026-09-12.json).

Operational status updated September 12, 2026 after the [latest inventory refresh](docs/validation/refresh-2026-09-12-comparison.md). The September 10 publication adds live Pages and remote CI evidence; earlier 1.1.0 release checks retain their September 8 dates. Original local commits `4835c0a` (delivery) and `42a6622` (improvements) are preserved in the private prepublication Git bundle. Their public-history equivalents exclude research fixture data. The public [PNelsonFTP/ClassicCars repository](https://github.com/PNelsonFTP/ClassicCars) is configured as `origin`. [Delivery status](docs/DELIVERY.md) records the approved publication and actual remote results.

## Open and review

The [web preview on 3100](http://127.0.0.1:3100) and [private API on 4410](http://127.0.0.1:4410/health) were restarted September 10; the worker remains off. Separate `npm run dev:web` and `npm run api` processes reproduce that state. The full `npm run dev` command below also starts the worker. Use **Settings & connection** with the password in the private `.env`; an API restart expires earlier sessions. Credentials are not included in the website.

```sh
npm ci
npm run setup
npm run dev
```

Setup preserves the database, environment/password, settings and workspace. The launchers provide the same local option. A fresh clone has the public snapshot but an empty connected database until intentional collection/import/restore. Existing preview processes are transient; the commands above reproduce them. Do not stop unrelated software to free a port.

## What changed

- Collection persists catalog page queues by source/query/scope, independent detail queues, job IDs/cancel/retry/recovery, and partial scheduling. Legacy observations now populate the operational backlog without inventing fresh requests. Source failures retain typed access/policy/layout/network causes, shared daily budgets, Retry-After and review pauses.
- Duplicate review ranks corroborated evidence, displays conflicts and all source asks/links, supports dealer aliases, conservative stock normalization, manual selection, pagination, dismiss/undo and overlapping merge-history replay. Ads remain source records; group counts are not verified unique cars.
- Saved searches offer vehicle/ad alert policies and optional crosspost notifications. Delivery uses immutable digest identities, deadlines, opt-in checks and visible blocked/uncertain/dead-letter recovery. The initial baseline remains quiet. No real external notification was sent.
- Geocoding validates address evidence, rotates work fairly and sends ambiguous records to explicit review. Routing honors caller freshness, exact endpoints/options, shared quotas and location changes. No real ORS routes exist without the missing key.
- Source/user provenance, field-specific reason/date, reset and generation recomputation are exposed in the UI. Public exports remove private evidence and reevaluate feed permissions/expiry. Browser availability ages from original observations, including auction freshness and deadlines.
- Static mode loads a smaller dictionary catalog with lazy exact-ad details. Rendered cards are paginated. API reads use bounded batches and source/favorite prefilters; remaining all-match memory/rescans are documented. Image failures try only that ad's own photos.
- Backend URL editing now stays separate from the authenticated endpoint, and redirects are rejected. Debounced private-workspace writes are serialized through acknowledged revisions; a conflict retains edits on screen for explicit recovery rather than silently overwriting another tab.
- Authorized feed import, a permission-gated eBay request adapter, specialty documentary evidence and dated year-ceiling data are available. No provider agreement or live auction feed was fabricated. New operational/readiness/service/release/SBOM tools have runbooks.

## Inventory and outstanding data work

The **September 12, 2026 refresh** retains **3,276 ads / 3,254 groups**, including **3,257 public ads**. It added **79 ads**, observed **47 numeric asking-price changes** (37 decreases, 10 increases), and refreshed details for **226 distinct ads**. All accessible configured catalogs completed: 25 regional and 49 national ClassicCars pages plus 20 dealer pages, with no catalog failures or cache hits. Five dealer detail queues are fully fresh; J & S Motors has 22 refreshed details and two older URLs returning 404. ClassicCars completed its configured 50-detail batch; 3,026 details remain due, rather than blocked by the daily budget. Autotrader and 500 Classic remain paused without new requests. See the [dated comparison](docs/validation/refresh-2026-09-12-comparison.md) for original observation dates and exact limits. Ads and groups are not verified unique physical vehicles; strict four-hour matches still require actual road routes.

The September 12 collection ran through the CLI and is finished; the automatic worker remains off. Public exports were rebuilt at both root and `/ClassicCars`, with a new private consistent database/environment backup. Earlier dated results follow.

The September 10 run retained **3,197 ads / 3,175 groups**, with **3,178 public ads**, 58 additions and 1,045 distinct fresh detail observations. All six active dealer detail queues are fresh and complete. ClassicCars has 870 newly observed details; its remaining work is paused at the configured 1,000-request daily limit. 500 Classic and Autotrader remain paused, and restricted or disabled sources remain uncollected. The [refresh comparison](docs/validation/refresh-2026-09-10-comparison.md) reports price/status changes, original observation dates, quotas and due/retry counts. No sale is inferred from absence.

The September 8 catalog-only release refresh retained **3,139 ads / 3,139 current groups** from nine sources, with **3,120 ads publicly exportable**, 16 established coordinate records and zero actual routes. The scan fetched **93 fresh catalog pages**, completing at `2026-09-08T17:23:23.991Z`. Initial inventory was 1,576 ads, with 1,557 publicly exportable. A subsequent three-query national ClassicCars check fetched three pages and three details successfully and retained further page/detail work. The final configured catalog scan, refreshed counts, scope limits and blocked sources are recorded in [inventory scan evidence](docs/validation/inventory-full-scan.json) and [scope validation](docs/CONFIGURED_SCOPE_VALIDATION.md).

That September 8 scan covered the configured inventory catalogs of enabled, permitted adapters. It is not a claim that all US sellers or all detail pages have been inspected. Full detail enrichment remains a separate cumulative queue. Existing 500 Classic and Autotrader restrictions remain paused; disabled marketplaces/forums are not enabled by the scan. Prior observations survive unavailable sources and failed pages. The public snapshot continues to exclude Autotrader.

The strict four-hour search remains empty until actual fresh road routes exist. Use **Travel time unknown · review** to inspect unresolved candidates. Coordinates and straight-line miles never become drive times. Most specialty claims still require documentation or review. Cross-listed duplicate cars may remain separate even after the new matching tools were implemented.

## Website options and publication

**GitHub Pages remains fully supported and does not require Docker.** It serves the static frontend and dated public inventory; browser-local shortlists/notes/searches work without a backend. Private collection, SQLite, route jobs and scheduled alerts require a separately running local API/worker. HTTPS-to-local-network access is browser-dependent and needs validation at the intended deployed origin.

```sh
npm run export:snapshot
npm run build:exports
npm run verify:exports
```

The root build is `out/`; the `/ClassicCars` example is `out-subpath/`. Set `NEXT_PUBLIC_BASE_PATH` to the actual repository name before release. The manual Pages Actions workflow uploads static output only, with pinned actions. The user has approved delivery after local review; [delivery status](docs/DELIVERY.md) records the selected destination and actual publication result.

Docker is an optional local packaging route. The pinned Linux arm64 image built and passed isolated release checks. Its static output contains build-time data and requires a refresh/rebuild or connected mode. `docker compose up --build` is available, but no Compose deployment or OS autostart was installed. `npm run service -- generate` produced reviewable startup templates; install/uninstall are explicit operator actions.

## Checks and evidence

The September 10 inventory refresh passed **248 tests / 25 files**, strict TypeScript, both static builds, browser export checks and a 179-file public privacy/consistency scan. Publication added 11 SBOM regression tests; the final suite passes **259 tests / 26 files**, with all six remote CI jobs and live Pages verification passing. [The dated validation record](VALIDATION.md) links the receipts. The private post-refresh backup is retained; source data and personal state remain outside Git.

[VALIDATION.md](VALIDATION.md) records the September 8 results: 222 passing unit/API tests, 16 passing desktop/mobile browser tests, both static builds and final export privacy checks. The September 8 [static review receipt](docs/validation/static-review.json) matches the 3,120-ad snapshot. Clean macOS Node 24 and Linux Docker Node 24 passed the release smoke. The September 10 GitHub native matrix now also passes Node 24 on Ubuntu, Windows and macOS, plus Node 22.18.0 on Ubuntu, including setup, SQLite, restore, startup and SBOM checks. The Windows double-click launcher is still a separate manual acceptance check. Native Chromium 153 WebMCP registration/invocation/lifecycle passed without a polyfill. Local root/subpath isolation passed; public HTTPS-to-private-backend connectivity remains a separate check; the static Pages site is live and verified.

[SBOM.md](SBOM.md) links full/runtime CycloneDX, SPDX, all 471 lock locations/licenses, native/WASM hashes, target OS evidence and the September 8 zero-vulnerability advisory query. Four formerly unresolved optional-WASM package versions were directly inspected in the integrity-verified archive. This is package inventory evidence, not blanket source-content redistribution permission.

## Resume external acceptance when ready

```sh
npm run verify:routing
npm run verify:delivery -- --channel=webhook
npm run verify:delivery -- --channel=email
npm run coverage:report -- docs/CONFIGURED_SCOPE_VALIDATION
```

Readiness commands send nothing by default. Real routing requires `MUSCLESCOUT_ORS_KEY` and explicit `--live`; a synthetic notification requires a user-authorized destination, enabled channel and `--send-test`. See [service acceptance](docs/SERVICE_ACCEPTANCE.md) for route geometry/receipt review and uncertain-send recovery. Approved feed files stay private and import dry-run unless `--apply` is supplied. Live source permission and credentials remain external inputs; [delivery status](docs/DELIVERY.md) tracks remote platform acceptance.

Back up with `npm run backup` before changing persistence. Keep SQLite/environment backups private; separately preserve raw evidence and browser-only exports when needed. [Operations](docs/OPERATIONS.md) documents restore, [architecture](docs/ARCHITECTURE.md) maps code/APIs, and [future work](FUTURE_IMPROVEMENTS.md) retains all real-world struggles.
