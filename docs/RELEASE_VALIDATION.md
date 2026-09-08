# Release and supply-chain validation

The implemented CI matrix installs the locked dependency tree on Node24 Linux, Windows and macOS, with an additional minimum-supported Node22.18 Linux job. It runs types, unit tests, an isolated setup/migration/native-SQLite/backup/API smoke check, SBOM generation, full schema validation and a dependency inventory comparison. Browser CI exercises desktop/mobile behavior plus root and `/ClassicCars` static exports. Container CI builds the pinned image locally, runs the same isolated smoke test and extracts its target inventories. No workflow or container deployment is triggered by writing these files.

```sh
npm run test:release
npm run sbom
npm run sbom:artifacts
npm run sbom:validate
npm run build:exports
npm run verify:exports
```

`test:release` creates its own temporary database and fixed test API port 4418. It runs setup twice, checks password preservation and migration/native SQLite integrity, restores a backup sentinel, and verifies API startup/shutdown. Tests never use the private shopping database. The actual Windows launcher still requires execution on Windows; a cross-platform smoke script passing on macOS is not evidence of Windows behavior.

The SBOM validator uses pinned local CycloneDX 1.5 and SPDX 2.3 schemas, verifies schema/input/artifact SHA-256 hashes and performs no network requests. `ajv`, `ajv-formats` and the supplementary international-format validator are explicit locked dev dependencies. npm's scp-style Git references are normalized to SSH URIs with the exact original declaration retained as a component property. npm's `git+https` and `git+ssh` transports are validated as the underlying URI transport to address the supplementary validator's limited scheme list. [CycloneDX schema](https://cyclonedx.org/schema/bom-1.5.schema.json), [SPDX 2.3 schema](https://raw.githubusercontent.com/spdx/spdx-spec/v2.3/schemas/spdx-schema.json), [AJV format guidance](https://ajv.js.org/guide/formats)

`sbom:artifacts` hashes installed native `.node` and WASM files and records the nearest observed owning package version. On Debian-based target builds it also records the actual dpkg name/version/architecture inventory. Embedded third-party component versions are not inferred from parent packages. A Linux container artifact inventory cannot stand in for Windows or macOS target files, and dpkg inventory does not cover manually installed system files.

`scripts/compare-sbom.mjs baseline-inventory.json` records added/removed package locations and changes in version, declared license and integrity. CI archives these reports with the target SBOM; a diff is a review aid, not an automatic license approval or advisory conclusion. Regenerate advisory queries separately when needed.

All directly used GitHub Actions are pinned to full verified commits. The Docker base image uses a verified multi-platform Node24 digest. The workflow packages Pages directly with the pinned artifact action, avoiding a mutable action nested inside a composite uploader. Action updates and Docker/npm updates remain separate scoped Dependabot proposals. Runner images and apt packages still vary over time; record actual target contents rather than claiming a fully hermetic build. [Docker digest guidance](https://docs.docker.com/dhi/explore/security-concepts/digests/)

The Docker UI contains its build-time public JSON. Refresh the export and rebuild that image explicitly, or connect the UI to the local API for current inventory. The Pages workflow remains manually dispatched and no destination has been supplied. Native Chromium 153 WebMCP registration, invocation, reload, abort cleanup and independent-filter preservation passed without a polyfill; see [browser evidence](BROWSER_CONNECTIVITY_VALIDATION.md). Actual public HTTPS-to-local-network behavior still needs the supplied authorized target environment.


## Executed local review checks — September 8, 2026

The official macOS arm64 Node 24.20.0 clean install and release smoke passed; see [the exact checksum/input evidence](NODE24_VALIDATION.md). Linux arm64 Node 24.20.0 built from the pinned Docker base and passed all **222 tests in 20 files**, followed by isolated repeated setup, password preservation, migrations, native SQLite, backup/restore and API startup/shutdown. Both container test invocations used `--network none`; no private shopping database was mounted.

The local Docker image is `musclescout:1.1.0-review`. Exact image and target inventory evidence is retained in [docker-review.json](validation/docker-review.json) and the [Linux target SBOM manifest](sbom/targets/linux-arm64-node24/manifest.json). The target full graph has 367 dependencies plus the root application, runtime has 128 plus root, SPDX has 368 packages, and the lock has 471 locations with 368 present on Linux. Native/WASM evidence records 30 files; dpkg records 91 installed Debian packages. These counts describe that target rather than all possible platforms.

The browser suite passed 16 desktop/mobile checks. Root and `/ClassicCars` static builds passed with zero browser runtime errors or missing local assets, actual source images loaded, and path-specific workspaces isolated. GitHub Pages remains a standalone static deployment option; Docker is not required to host it.

The user reviewed the local preview and approved final delivery. The original local baseline is `4835c0a`; [delivery status](DELIVERY.md) records the final commit/push, publication and remote matrix results. Public HTTPS-to-local-network connectivity remains separate acceptance work. Current Docker build output is a retained local artifact; no Compose deployment was installed.
