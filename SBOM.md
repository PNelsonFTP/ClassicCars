# Software bill of materials

Generated September 8, 2026 UTC for `musclescout@1.0.0` on macOS arm64, Node `26.7.0`, npm `11.19.0`. The exact generation time, input SHA-256 values and output hashes are in [manifest.json](docs/sbom/manifest.json). The application has no declared distribution license; SPDX records `NOASSERTION`. No license for the original application has been invented.

## Delivered inventories

| Artifact | Format / coverage | Recorded size |
|---|---|---:|
| [Full installed SBOM](docs/sbom/musclescout.cdx.json) | CycloneDX 1.5 JSON; installed application, development, build, test and optional dependencies | 355 dependency components + root application |
| [Runtime dependency SBOM](docs/sbom/musclescout-runtime.cdx.json) | CycloneDX 1.5 JSON; npm installed graph with `--omit=dev` | 129 dependency components + root application |
| [SPDX SBOM](docs/sbom/musclescout.spdx.json) | SPDX 2.3 JSON; full installed graph | 356 packages including root, 628 relationships |
| [Full lockfile inventory](docs/sbom/lockfile-inventory.json) | Supplemental JSON; every resolved lock entry, requested edges, integrity, license and platform metadata | 458 package installation locations |
| [License inventory](docs/sbom/LICENSE_INVENTORY.md) | Direct dependency versions and all lock entries with declared license expressions | 458 entries; no missing license field in the current dependency lock |
| [Provenance manifest](docs/sbom/manifest.json) | Environment, inputs, counts, output hashes and scope limits | SHA-256 for each generated artifact |
| [Advisory report](docs/sbom/npm-audit.json) | Separate npm registry audit, queried September 8, 2026 UTC during documentation | 0 reported vulnerabilities |

Counts differ by design. The lockfile contains optional packages for other operating systems/architectures and repeated installation locations. On this host, 356 lock entries are installed; npm merges identical package/version identities into 355 dependency components. The root application is additional. The runtime subset is an npm dependency classification, not an exact inventory of JavaScript that survives bundling into a browser asset.

## What the records contain

The npm-generated CycloneDX/SPDX records include dependency names and versions, package URLs, available distribution URLs and integrity hashes, package-declared licenses and graph relationships. Root CycloneDX naming is normalized from the checkout directory name `ClassicCars` to the actual package name `musclescout`; a lockfile hash and inventory-basis property are added. No dependency version is synthesized.

The supplemental lock inventory preserves every lockfile location and its development/optional flags, OS/CPU/libc restrictions, declared regular/optional/peer dependency ranges and declared bundled dependencies. It records which locations were present on this generation host. The license table is package metadata, not a file-level analysis or a replacement for retaining dependency notices when redistributing software.

The current `package-lock.json` SHA-256 is:

```text
e8e19800d9cbdfb26b673831fc73ce96641c01ec7b577836db5a424f6f4c3092
```

## Known SBOM generation limitation

The attempted npm `--package-lock-only` SBOM export returned `ESBOMPROBLEMS` for the optional `@tailwindcss/oxide-wasm32-wasi@4.3.3` package. Its metadata declares bundled dependencies, and the lock-only exporter could not resolve four edges into separate exact-version entries:

| Declared dependency | Declared range |
|---|---|
| `@emnapi/core` | `^1.11.1` |
| `@emnapi/wasi-threads` | `^1.2.2` |
| `@napi-rs/wasm-runtime` | `^1.1.4` |
| `@tybys/wasm-util` | `^0.10.2` |

That WASM target is not installed on this macOS host. The installed-graph exports succeeded and include the dependencies actually resolved here; the separate lock inventory retains the optional WASM package, its tarball integrity and declared bundled ranges. Exact versions inside uninspected platform tarballs are intentionally not guessed. This is an explicit inventory gap for those bundled files, not a claim that a tested macOS dependency is missing or that every other platform was validated.

For a release targeting Windows/Linux/Docker/WASM, generate an installed SBOM inside the actual clean target build and inspect its bundled/native artifacts. Keep the target's platform metadata. A future lock-only exporter or a verified bundled-artifact scan may close this gap without changing application behavior. The generator retains this observation against the original lock hash as historical provenance; reevaluate it after lock changes.

## Regeneration

From the project root with the intended dependencies installed:

```sh
npm run sbom
```

This runs [scripts/generate-sbom.mjs](scripts/generate-sbom.mjs). It calls npm's built-in offline SBOM exporter, reads package/lock metadata, validates reference closure and direct dependency presence, then writes the three SBOMs, lock inventory, license table and hash manifest. It does not install/update dependencies, start application services, read `.env`, collect cars or refresh the advisory report. On a clean machine, run `npm ci` first. Windows execution of the generator has not been verified.

The underlying commands are:

```sh
npm sbom --offline --sbom-format=cyclonedx --sbom-type=application
npm sbom --offline --omit=dev --sbom-format=cyclonedx --sbom-type=application
npm sbom --offline --sbom-format=spdx --sbom-type=application
```

Refresh advisories separately when preparing a release:

```sh
npm audit --json > docs/sbom/npm-audit.json
npm run sbom
```

An audit command can exit nonzero when vulnerabilities are found; inspect its JSON and distinguish an advisory result from a network/configuration error. Update the observation date in this document and [validation](VALIDATION.md). An SBOM regeneration alone must not be described as a fresh vulnerability scan.

## Security and completeness boundaries

The documentation-time full audit reported zero vulnerabilities. Earlier Prisma CLI transitive advisories were addressed with the existing `deepmerge-ts` and `mysql2` overrides, recorded in `package.json`. A zero advisory count is a dated registry result, not a guarantee of defect-free software; the SBOM is an inventory, not an exploitability assessment.

These files inventory npm components. They do **not** fully inventory the host OS, the Node executable, the Playwright-downloaded browser, GitHub Actions runner images, container OS packages or every file bundled inside native/WASM artifacts. Docker has not been built/validated here. The Docker base image and Actions are referenced by version/tag rather than immutable release digests; pinning and target-image SBOMs are tracked in [future improvements](FUTURE_IMPROVEMENTS.md).

PostgreSQL-related tooling may appear transitively through Prisma; MuscleScout itself uses SQLite and does not require a PostgreSQL service. Likewise, package presence does not establish that every optional library is exercised by the app.

Third-party vehicle listings/photos, geocoding responses, OpenStreetMap tiles/data, ORS, npm registry services and GitHub hosting are external content/services, not npm software license grants. Their source-specific access/redistribution limitations are documented in [source coverage](SOURCE_COVERAGE.md) and [future improvements](FUTURE_IMPROVEMENTS.md). Credentials, private inventory history and user workspaces are deliberately absent from the SBOM artifacts.
