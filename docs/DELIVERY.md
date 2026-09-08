# MuscleScout 1.1.0 delivery

Updated September 8, 2026. The user reviewed the local preview and approved the final commit, push and cleanup. GitHub repository selection is pending because the checkout initially had no remote. The publication and remote validation results will be recorded here when available.

## Reviewed release

- 222 unit/API tests and 16 desktop/mobile browser tests passed.
- Root and `/ClassicCars` static exports built and passed export checks.
- The final catalog scan fetched 93 fresh pages and retained 3,139 ads, including 3,120 public ads. Blocked sources and outstanding detail work remain documented.
- Clean macOS Node 24 and Linux arm64 Docker release checks passed. Host/container SBOM schema and hash checks passed; the recorded advisory query found zero vulnerabilities.
- Private environment, database, caches, logs and backups remain ignored. Public export inspection found no configured backend secrets or private listing fields.

See [validation](../VALIDATION.md), [inventory scan](validation/inventory-full-scan.json), [SBOM](../SBOM.md) and [remaining work](../FUTURE_IMPROVEMENTS.md) for exact evidence and limits.

## Runtime and retained artifacts

The task-owned web preview (port 3100), API (port 4410) and background worker were stopped and their process/listener shutdown was verified. Start the local runtime again with `npm run dev` from the project directory; setup and launchers are described in [the handoff](../HANDOFF.md). No OS autostart service or Compose deployment was installed. Private backups, cached evidence and the reviewed Docker image are retained locally.

GitHub Pages serves the static frontend and dated public inventory independently of Docker. Collection, private SQLite state, routes and scheduled alerts require the local API and worker. Public HTTPS-to-local-network browser connectivity remains a separate acceptance check.
