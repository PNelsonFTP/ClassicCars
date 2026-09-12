# MuscleScout 1.1.0 delivery

## September 12 inventory update

The requested refresh added 79 ads and rebuilt the public snapshot with 3,257 ads. All 94 accessible configured catalog pages refreshed; 226 detail checks succeeded, with two J & S Motors URLs returning 404. ClassicCars has a separate 3,026-ad detail backlog after its configured 50-detail batch. Autotrader and 500 Classic remain paused. See the [comparison](validation/refresh-2026-09-12-comparison.md) and [privacy/consistency receipt](validation/public-export-review-2026-09-12.json). Publication of this updated snapshot is being verified; the September 10 deployment record below remains historical.

## GitHub publication — September 10, 2026

The project is committed and pushed to the public [PNelsonFTP/ClassicCars repository](https://github.com/PNelsonFTP/ClassicCars). [MuscleScout is live on GitHub Pages](https://pnelsonftp.github.io/ClassicCars/) with HTTPS enforced and project base path `/ClassicCars`. The [deployment of `ea6be78`](https://github.com/PNelsonFTP/ClassicCars/actions/runs/34547932246) succeeded. Private environment files, the local database, caches, logs and backups remain excluded from Git; the redacted public snapshot is included.

Before the first public push, seven research-derived fixtures were removed from the unpublished branch history. Public replacements use wholly synthetic Autotrader records and omit real VIN/contact fields in six other fixtures. The original local history remains in a private ignored Git bundle. Only the sanitized `main` branch was pushed; private backup and tool-capture refs were not published.

The live [browser and data receipt](validation/github-pages-2026-09-10.json) confirms HTTPS 200, 3,178 public ads, exact catalog/snapshot/detail-chunk hashes, typo-tolerant search, a working detail dialog, real image loading, and no runtime errors or missing local assets. Desktop 1440px and mobile 390px/375px checks passed without horizontal overflow or a clipped Save search button. The snapshot was generated at `2026-09-10T23:06:00.330Z`; publication does not change source observation dates.

The deployed application commit is `ea6be783a46bc37d5d7656ece71b22dadfe0e2b0`. The subsequent `844e9cd` correction changes Git handling of vendored schema bytes and the implementation log; it does not change the static application or inventory. This delivery record is a documentation-only follow-up. Future snapshot updates require a new export, commit/push and manual **Publish MuscleScout snapshot** workflow run with `/ClassicCars`.

The final [GitHub CI run on `844e9cd`](https://github.com/PNelsonFTP/ClassicCars/actions/runs/34548198449) passed all six jobs:

- Node 24 on Ubuntu 24.04, Windows 2025 and macOS 15, plus Node 22.18.0 on Ubuntu: clean install, strict types, 259 tests, isolated setup/migration/SQLite/backup/restore/API smoke, SBOM generation, native inventory, schema/hash/reference validation and dependency comparison.
- Browser: 16 desktop/mobile tests, root and `/ClassicCars` builds, image and export checks.
- Container: Linux x64 Docker build, isolated release smoke and target SBOM/native/dpkg inventory.

The [permanent release receipt](validation/github-release-2026-09-10.json) records job results, artifact URLs, exact target counts and verified report hashes. GitHub retains these artifacts for 14 days; the full downloaded reports and CI log are also retained locally in the ignored `backups/github-release-34548198449.tar.gz` archive. The earlier failed runs remain visible: they exposed the Windows loader URL, npm 10 duplicate SBOM IDs and Windows schema line endings, all corrected before the passing run. No dependency versions changed and no new advisory audit is claimed.

## September 10 local refresh status

The [refresh comparison](validation/refresh-2026-09-10-comparison.md) records the latest data and outstanding source/detail limits. Both root and `/ClassicCars` exports were rebuilt and validated with 3,178 public ads. The local preview on 3100 and API on 4410 are running; the worker is off. The approved September 8 improvement commit is `42a6622`. This refresh is included in the newly authorized GitHub delivery above.

Historical September 8 status: the user approved delivery after local review, but repository selection was then pending. The September 10 publication above supersedes that hold.

## Reviewed release — September 8, 2026

- 222 unit/API tests and 16 desktop/mobile browser tests passed.
- Root and `/ClassicCars` static exports built and passed export checks.
- The final catalog scan fetched 93 fresh pages and retained 3,139 ads, including 3,120 public ads. Blocked sources and outstanding detail work remain documented.
- Clean macOS Node 24 and Linux arm64 Docker release checks passed. Host/container SBOM schema and hash checks passed; the recorded advisory query found zero vulnerabilities.
- Private environment, database, caches, logs and backups remain ignored. Public export inspection found no configured backend secrets or private listing fields.

See [validation](../VALIDATION.md), [inventory scan](validation/inventory-full-scan.json), [SBOM](../SBOM.md) and [remaining work](../FUTURE_IMPROVEMENTS.md) for exact evidence and limits.

## Runtime and retained artifacts

The task-owned web preview, API and worker were stopped and their shutdown verified on September 8. The web preview (3100) and API (4410) were restarted September 10; the worker remains off. Separate web/API commands preserve that state, while `npm run dev` also starts the worker; see [the handoff](../HANDOFF.md). No OS autostart service or Compose deployment was installed. Private backups, cached evidence and the reviewed Docker image are retained locally.

GitHub Pages serves the static frontend and dated public inventory independently of Docker. Collection, private SQLite state, routes and scheduled alerts require the local API and worker. Public HTTPS-to-local-network browser connectivity remains a separate acceptance check.
