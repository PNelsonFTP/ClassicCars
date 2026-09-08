# Validation

Verified September 8, 2026 UTC / September 7 evening, America/Chicago. Tests ran on macOS, Node 26.7.0, npm 11, Chromium, and the project’s package lockfile. This report distinguishes executed checks from supplied integrations.

| Check actually run | Result |
|---|---|
| `npm run typecheck` | Passed after implementation and final regression fixes. |
| `npm test` | 52 tests passed across search, backend, security and sanitized source adapters. |
| `npm run test:e2e` | 10 tests passed, five each at desktop and mobile sizes, using a disposable API/database on 4411. |
| Root static build | `npm run build` passed; output retained in `out/`. |
| Repository-path static build | `NEXT_PUBLIC_BASE_PATH=/ClassicCars npm run build` passed; output retained in `out-subpath/`. |
| `npm run verify:exports` | Both exports served at the same temporary origin; search and actual images loaded, zero runtime errors and zero missing local assets. Root/subpath shortlists remained independent. |
| Public export inspection | Scanned 78 files across both exports for actual configured backend secret values and sample payload markers. No secrets or fictional records found. All 1,557 snapshot ads omit raw evidence, full identifier fields, private overrides and original seller prose. No zero-price placeholders remain. |
| Fresh database setup | Both Prisma migrations applied to a new disposable SQLite database; zero imported/sample ads, initialized settings/workspace. |
| Repeated setup | Exact comparisons confirmed existing password file, settings, inventory count and personal workspace were preserved. |
| Backup | Consistent `VACUUM INTO` database backup and private environment copy created; backup directory restricted to owner access. |
| Port conflict | Standard startup on occupied 3100 rejected with an actionable error and left existing applications running. |
| Concurrent independent applications | Existing boating web service on 3000, MuscleScout web on 3100 and MuscleScout API on 4410 all returned HTTP 200 simultaneously. No boating files or browser workspace were imported. |
| Shared-origin browser state | Real root/subpath MuscleScout builds used one browser context; a synthetic separate-app storage sentinel remained unchanged. Actual BoatScout shared-origin deployment was not modified or used as test state. |
| macOS launcher | Shell syntax checked; its setup/dev command paths were executed separately. |
| Dependency audit | Final runtime `npm audit --omit=dev --audit-level=moderate` reported zero vulnerabilities; earlier full audit also reported zero after dependency overrides. |
| Visual inspection | Desktop, narrow mobile, coverage and settled real-image views inspected. Responsive layouts, keyboard dialog access and horizontal overflow checked by browser tests. |

## Behavioral evidence

Search tests cover inclusive classic years and verified model boundaries, Camero normalization, half-year wording, unknown identity review, specialty OR logic with common AND filters, specialty-off defaults, later ordinary-car exclusion, seller-only specialty claims, multiple-state OR filtering, equipment/claim rules, unknown values, exactly 240 minutes, expired/future/off-site/ambiguous routes, and a Lake Michigan detour scenario. Historical and modern identifiers have conservative separate grouping rules; weak lookalikes are review candidates.

Backend tests use independent SQLite databases. They cover authentication and exact allowed origins, unsafe import rejection, shared API search, nationwide collection demand, renewable lease exclusion/recovery, first-seen/history preservation, quiet initial alert baselines, price/availability alert idempotency, bid opt-in and stable deadline alerts, revision conflicts, notes/favorites preservation, reversible reviewed groups, snapshot redaction, location invalidation, retained source-price evidence, durable user corrections, shared stale-inventory semantics, and progress across capped route jobs.

Source fixtures exercise stable card IDs and correct images, duplicated sparse cards, separate monthly/ask/average-price fields, explicit sold status versus hidden modal text, Midwest alternating table cells, ADM main-detail isolation, North Shore literal data links and exact-ID public detail HTML, ClassicCars exact detail identity and off-site claims, Autotrader active-result identities, and unavailable detail rejection. An additional 34 offline dealer-evidence assertions were run during parser development; those private raw-cache checks are research evidence, not part of the portable test suite.

Browser flows cover search, unknown-route review, specialty controls, source coverage, favorites, notes, comparison, saved-search previews, manual/imported entries, reload persistence, theme, keyboard access, map/list independence and connected/snapshot separation. Passwords were not persisted in browser storage. The real local API was restarted with final code; the local worker is running with external delivery disabled.

## Executed live work and limits

The initial collection produced 1,576 observed ads from nine sources. All 26 configured source candidates have documented access/scope findings. Production adapters were exercised with bounded live requests and cached reruns; seven passed live production inventory parsing checks during the initial session. Autotrader's later unavailable template and 500 Classic's 403 remain visible failures, preserving earlier observations. North Shore's initial empty shell was rejected during review; its permitted public detail endpoint was then fetched and parsed successfully. A Shopify zero-price placeholder was corrected in both the canonical record and ask history, retaining a parser-correction observation and private raw evidence.

Collection request/detail caps and outstanding enrichment remain visible. Most ads are catalog observations, not fully inspected vehicles. No source completeness statement means regional market completeness. Actual network dates and cached reads are separate in the run ledger. See `SOURCE_COVERAGE.md` and `LIVE_DATA.md` for counts, scope and gaps.

## Unverified integrations

- **Road routing:** ORS request construction, missing-key fallback and a fake-provider regression were tested; no credential was supplied, so live ORS responses, quotas and actual four-hour matches remain unverified. Zero drive-time values were invented.
- **External alerts:** in-app evaluation and persistence tested. No email/webhook destination was configured, no message sent, and delivery-network behavior remains unverified. Delivery attempts/failures are visible when connected.
- **Nationwide collection:** broader source configuration and durable queue requests tested; a full national collection was not run. Auction/forum integrations requiring access or permission remain uncollected.
- **Deployment:** local root and subpath exports tested. No GitHub repository/destination was supplied and no external publication occurred. HTTPS backend connectivity from a public Pages site remains unverified.
- **Other platforms:** Windows launcher, Node 24 execution and Docker Compose are supplied but not run on this host. macOS/Node 26 is the executed local path.
- **WebMCP:** feature-detected search registration is implemented. A browser exposing the proposed `document.modelContext` API was not available for a supported-context end-to-end test.

No seller claims, odometer readings, identifiers or specialty badges were independently authenticated. Inspection before purchase remains a user's research workflow, not a conclusion from this software.


## Documentation and SBOM follow-up — September 8, 2026 UTC

The follow-up request added the handoff, architecture/API reference, operations/restore procedures, implementation log, future-improvement register, SBOM guide and generated dependency artifacts. README now indexes them. Initial research reports have archive/current-state banners; auction and duplicate-count wording was clarified without rewriting source observations.

Checks actually run for this follow-up:

- `npm run sbom` completed using npm 11.19.0's offline installed-graph exporter: CycloneDX 1.5 full/runtime and SPDX 2.3, plus all 458 lockfile locations and declared licenses. Root/component dependency reference closure and direct-dependency presence were checked by the generator.
- The provenance manifest's five generated artifact hashes, package and lockfile hashes, and separately saved advisory-report hash were independently recomputed and matched.
- A fresh full `npm audit --json` query reported zero vulnerabilities. This is distinct from the prior runtime-only check and from offline SBOM generation.
- Fifteen Markdown documents were checked for local file links: 91 targets existed with zero broken file links at that check. The SBOM generator passed Node syntax and Prettier checks; generated documentation/artifacts contained no local user-home path or obvious credential/token patterns.
- Read-only duplicate analysis found 23,963 weak title/model/year pairs, including 1,156 across sources; no repeated strong key or automatic group. These metrics are not confirmed duplicates and are documented with the algorithm/UI limits.

The initial attempted npm lock-only SBOM export failed on four declared bundled dependencies of an optional WASM platform package. The delivered host-specific SBOMs and supplemental lock inventory state that coverage limit; no missing exact bundled versions were fabricated. Full external CycloneDX/SPDX schema-validator tooling and target-platform/container inventories remain future release checks.

This documentation pass did not rerun application browser/build suites, recollect inventory, change personal data, modify application behavior or send external alerts. The only new executable utility is the offline `sbom` documentation command; prior application validation results above retain their original date/scope. The open issues found by code review are recorded in [FUTURE_IMPROVEMENTS.md](FUTURE_IMPROVEMENTS.md), not described as fixed by documentation.
