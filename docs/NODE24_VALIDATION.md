# Observed Node24 release validation

On September 8, 2026 UTC, a clean disposable checkout was installed under official Node **v24.20.0**, macOS arm64, without replacing the host Node26 or changing the live shopping database. The release was published August 26, 2026.

The downloaded [official macOS arm64 archive](https://nodejs.org/dist/v24.20.0/node-v24.20.0-darwin-arm64.tar.gz) matched SHA-256 `40e5607e5ecb3db9192723776da2d75d966260fc74a7a9e731c1bd67dda96bc8` in the same release's [official checksums](https://nodejs.org/dist/v24.20.0/SHASUMS256.txt).

`npm ci` installed 369 packages from the copied lockfile, generated Prisma Client 7.10.0 and reported zero advisory vulnerabilities at that time. The isolated release check passed two setups, password preservation, migrations, native SQLite loading/integrity, backup/restore of a sentinel and API startup/shutdown. Only temporary files and test port 4418 were used.

Target SBOMs generated under that Node24 installation passed full offline CycloneDX 1.5/SPDX 2.3 schema and input/artifact hash validation. The full CycloneDX graph contains 368 dependency components; runtime graph 128; SPDX 369 packages including the root; full lock inventory 471 installation entries. The native/WASM inventory records 31 actual files and hashes. There is no dpkg inventory on macOS.

The tested package-lock SHA-256 was `137a19675509a0aa657972101bd00299d307acf601a330f230cddc50dacf5d03`; package.json SHA-256 was `7b19ae7cfffa1046a27803a8cc7d555a0ea404498d88cf80b3eb2d98f8da32b7`. Later dependency changes require a new target run. This evidence does not establish Windows or Linux/Docker behavior.

Reproduction uses `npm ci` under Node24, then `npm run test:release`, `npm run sbom`, `npm run sbom:artifacts` and `npm run sbom:validate`. The release test performs no inventory collection or external notifications.

The final 1.1.0 review lock has a different root application version/hash. A direct comparison confirmed that all non-root resolved dependency entries are identical to this clean Node 24 install. The final integrated 222-test suite also passed separately on macOS Node 26 and Linux Docker Node 24.
