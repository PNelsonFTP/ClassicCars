# MuscleScout 1.1.0 delivery

## GitHub publication — September 10, 2026

The user explicitly approved creating a new public repository, committing and pushing the project, and hosting its static website with GitHub Pages. [PNelsonFTP/ClassicCars](https://github.com/PNelsonFTP/ClassicCars) is now the public repository and configured Git remote. The project-site base path is `/ClassicCars`; the Pages URL is [MuscleScout](https://pnelsonftp.github.io/ClassicCars/). The first push and deployment validation are in progress. Private environment files, the local database, caches, logs and backups remain excluded from Git; the redacted public snapshot is included.

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
