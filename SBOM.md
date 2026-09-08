# Software bill of materials

Updated September 8, 2026 UTC for **musclescout@1.1.0**. The application has no declared distribution license; SPDX records `NOASSERTION`. Generation times, platform, input hashes and output hashes are retained in each target's manifest.

## Delivered inventories

| Artifact | Scope and observed count |
|---|---|
| [Full CycloneDX 1.5](docs/sbom/musclescout.cdx.json) | macOS arm64 Node 26.7.0 installed graph: 368 dependency components plus the application. |
| [Runtime CycloneDX](docs/sbom/musclescout-runtime.cdx.json) | npm `--omit=dev` graph: 128 dependency components plus the application. |
| [SPDX 2.3](docs/sbom/musclescout.spdx.json) | 369 packages including the application; 645 relationships. |
| [Complete lock inventory](docs/sbom/lockfile-inventory.json) | All 471 resolved installation locations, including optional platforms; 369 installed locations on the host. |
| [Declared licenses](docs/sbom/LICENSE_INVENTORY.md) | Direct requirements and every lock entry's declared license expression. |
| [Host artifact inventory](docs/sbom/target-artifacts.json) | 31 observed native/WASM files, owning package versions, byte sizes and SHA-256 hashes. |
| [Bundled archive inspection](docs/sbom/bundled-artifacts.json) | Seven directly inspected package manifests; all four formerly unresolved bundled package versions observed. |
| [Manifest](docs/sbom/manifest.json) | Hashes for the seven main/artifact reports, package/lock inputs and separate advisory report. |
| [npm audit](docs/sbom/npm-audit.json) | Fresh full registry query on September 8, 2026, approximately 17:09 UTC: zero reported vulnerabilities. |

Counts differ because npm merges repeated package/version identities, the root is additional, and the lock contains optional packages for other targets. Runtime classification is not an inventory of code that survives browser bundling. Licenses are declared package metadata, not a file-by-file legal review.

The exact current lockfile SHA-256 is `cdd0f7991945234d59d82283f2a974b7e77efa6302aae60116d4066081cdb1aa`.

## Resolved optional-WASM metadata gap

The original npm lock-only exporter returned `ESBOMPROBLEMS` for bundled dependencies inside `@tailwindcss/oxide-wasm32-wasi@4.3.3`. The exact locked archive was subsequently obtained and its SHA-512 integrity checked against the lock; its SHA-256 is `d5b61fbe10d237f7565032a74b03b5be6c83b309037ee407e2b5b46f24738823`. It was inspected without installing or executing it.

| Previously unresolved bundled dependency | Directly observed version |
|---|---|
| `@emnapi/core` | 1.11.1 |
| `@emnapi/wasi-threads` | 1.2.2 |
| `@napi-rs/wasm-runtime` | 1.1.4 |
| `@tybys/wasm-util` | 0.10.2 |

The historical exporter limitation remains documented, but these exact package versions are no longer guessed or unknown. Archive contents are separate evidence from packages installed on a particular host. Embedded Rust/native components are not inferred from the nearest npm package version. See [inspection details](docs/BUNDLED_WASM_REVIEW.md).

## Platform and container evidence

A fresh official Node 24.20.0 macOS arm64 installation passed clean `npm ci`, repeated setup, migration/native SQLite, backup/restore, API startup/shutdown and schema validation; see [Node 24 evidence](docs/NODE24_VALIDATION.md). The pinned Linux arm64 Node 24 image also built and passed the isolated release smoke. Its installed dependency and native/dpkg inventories are captured in the [Linux target manifest](docs/sbom/targets/linux-arm64-node24/manifest.json) and [release evidence](docs/RELEASE_VALIDATION.md), rather than being substituted for the macOS host reports.

Windows and other unexecuted architectures remain pending CI targets. Container dpkg evidence inventories observed Debian packages; manually installed OS files, the host operating system, downloaded browsers, complete embedded native component graphs and GitHub runner images remain outside the main npm SBOM. Action commits and the multi-platform Node base digest are pinned; apt and hosted runner inputs are still time-dependent.

## Reproduction and review

```sh
npm ci
npm run sbom
npm run sbom:artifacts
npm run sbom:validate
npm run sbom:compare -- path/to/previous-lockfile-inventory.json
```

Generation and validation are offline. They read package metadata and installed artifacts, without application secrets or private inventory. The validator uses pinned local full CycloneDX/SPDX schemas with AJV, validates input/output hashes and graph references, and checks direct dependency presence. npm scp-style Git references are normalized to SSH URIs with their exact original values retained. A documented scheme normalization accommodates npm Git transport prefixes.

`sbom:artifacts` records actual native/WASM file hashes and dpkg versions where available, then adds those report hashes to the manifest. `sbom:bundled -- --archive=/path/to/exact-locked-package.tgz` repeats the separate archive integrity/manifest check. Regenerate the main SBOM and artifacts afterward to record the new evidence hash. The [baseline-to-1.1.0 comparison](docs/validation/dependency-diff.json) adds 13 lock locations for schema validation and changes/removes no prior package locations.

Refresh advisory data separately:

```sh
npm audit --json > docs/sbom/npm-audit.json
npm run sbom
npm run sbom:artifacts
npm run sbom:validate
```

An offline regeneration is not a new advisory query. Inspect audit JSON on nonzero exit to distinguish vulnerabilities from a service failure. Existing `deepmerge-ts` and `mysql2` overrides remain until verified upstream fixes permit their removal. Zero reported advisories is a dated result, not a guarantee of defect-free software.

CI archives target inventories, full-schema results and dependency diffs. The diff is a review aid, not automatic license approval. Third-party listings/photos, maps and routing services have separate permissions; their availability is not granted by npm licenses. No private database, password, destination or user workspace is part of these inventories.
