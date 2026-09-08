# Resolved optional-WASM package manifest gap

On September 8, 2026 UTC, the exact locked `@tailwindcss/oxide-wasm32-wasi@4.3.3` [registry archive](https://registry.npmjs.org/@tailwindcss/oxide-wasm32-wasi/-/oxide-wasm32-wasi-4.3.3.tgz) was inspected without installation, filesystem extraction or execution. Its SHA-512 matched the lockfile integrity value; archive SHA-256 was `d5b61fbe10d237f7565032a74b03b5be6c83b309037ee407e2b5b46f24738823`.

The four earlier unresolved optional bundled edges now have directly observed package manifest versions:

| Package | Observed version |
|---|---|
| @emnapi/core | 1.11.1 |
| @emnapi/wasi-threads | 1.2.2 |
| @napi-rs/wasm-runtime | 1.1.4 |
| @tybys/wasm-util | 0.10.2 |

`docs/sbom/bundled-artifacts.json` records the archive integrity, all seven observed package manifests, their declared licenses/dependencies and individual SHA-256 hashes. These are observed archive contents, not versions inferred from allowed dependency ranges or from the owning WASM package.

Reproduce offline with `node scripts/inspect-bundled.mjs --archive=/path/to/oxide-wasm32-wasi-4.3.3.tgz`. If the archive is not present, `--fetch` explicitly retrieves only the exact lockfile registry artifact, verifies integrity, parses bounded archive metadata in memory and writes the report. Changing the locked archive invalidates this evidence and requires a fresh inspection.

This resolves the package-manifest version uncertainty for these four edges. It does not repair npm's historical lock-only export behavior, install the optional package on a different platform or claim an inventory of every embedded Rust/WASM component. Keep the observed archive report separate from platform-installed dependency graphs and continue target builds for their actual native artifacts.
