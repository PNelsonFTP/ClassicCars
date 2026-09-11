# MuscleScout handoff — 1.1.0

Operational status updated September 10, 2026 after the [local inventory refresh](docs/validation/refresh-2026-09-10-comparison.md). The 1.1.0 release checks remain dated September 8. Local commits `4835c0a` (original delivery) and `42a6622` (improvements) are preserved. The public [PNelsonFTP/ClassicCars repository](https://github.com/PNelsonFTP/ClassicCars) is configured as `origin`. [Delivery status](docs/DELIVERY.md) records the approved publication and actual remote results.

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

September 10 checks passed: **248 tests / 25 files**, strict TypeScript, both static builds, browser export checks and a 179-file public privacy/consistency scan. [The dated validation record](VALIDATION.md) links the new receipts. The private post-refresh backup is retained; source data and personal state remain outside Git.

[VALIDATION.md](VALIDATION.md) records the September 8 results: 222 passing unit/API tests, 16 passing desktop/mobile browser tests, both static builds and final export privacy checks. The September 8 [static review receipt](docs/validation/static-review.json) matches the 3,120-ad snapshot. Clean macOS Node 24 and Linux Docker Node 24 passed the release smoke; Windows and remote GitHub CI remain unexecuted targets. Native Chromium 153 WebMCP registration/invocation/lifecycle passed without a polyfill. Local root/subpath isolation passed; public HTTPS connectivity remains a separate deployment check.

[SBOM.md](SBOM.md) links full/runtime CycloneDX, SPDX, all 471 lock locations/licenses, native/WASM hashes, target OS evidence and the fresh zero-vulnerability advisory query. Four formerly unresolved optional-WASM package versions were directly inspected in the integrity-verified archive. This is package inventory evidence, not blanket source-content redistribution permission.

## Resume external acceptance when ready

```sh
npm run verify:routing
npm run verify:delivery -- --channel=webhook
npm run verify:delivery -- --channel=email
npm run coverage:report -- docs/CONFIGURED_SCOPE_VALIDATION
```

Readiness commands send nothing by default. Real routing requires `MUSCLESCOUT_ORS_KEY` and explicit `--live`; a synthetic notification requires a user-authorized destination, enabled channel and `--send-test`. See [service acceptance](docs/SERVICE_ACCEPTANCE.md) for route geometry/receipt review and uncertain-send recovery. Approved feed files stay private and import dry-run unless `--apply` is supplied. Live source permission and credentials remain external inputs; [delivery status](docs/DELIVERY.md) tracks remote platform acceptance.

Back up with `npm run backup` before changing persistence. Keep SQLite/environment backups private; separately preserve raw evidence and browser-only exports when needed. [Operations](docs/OPERATIONS.md) documents restore, [architecture](docs/ARCHITECTURE.md) maps code/APIs, and [future work](FUTURE_IMPROVEMENTS.md) retains all real-world struggles.
