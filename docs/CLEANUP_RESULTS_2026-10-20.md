# Approved cleanup and verification — October 20, 2026

Completed the user-approved High and Medium cleanup from the [original review](PROJECT_REVIEW_2026-10-20.md) and [frozen candidate list](CLEANUP_CANDIDATES_2026-10-20.csv). All 182 Low-confidence files remain byte-for-byte unchanged. The inventory is still the October 19 export; no collection, commit, push or deployment was performed.

## Removed and retained

All **46 approved candidate entries** were removed after checking consumers and current contents: 11 Finder metadata files, the TypeScript incremental cache, Playwright last-run status, the empty `lib/` directory, four old generated-output directories, and 14 redundant database/environment backup pairs. No approved candidate was found in active use. The process/open-file check used unrestricted read-only `ps`/`lsof`; no matching application process, candidate open file, expected user LaunchAgent or listener on the verification/application ports was found.

For each removed backup pair, both database and environment content were compared again with the required retained pair. Each retained database passed SQLite `quick_check`. The latest post-refresh October 19 pair was separately protected. **17 backup pairs remain**, preserving all 17 distinct database states; all 17 databases pass integrity checks. The private release archive and prepublication Git bundle were retained.

The application needs current generated files for serving and type imports, so verification recreated `.next/`, `out/` and `out-subpath/`. These validated outputs are retained. The inactive root `.next-dev/` remains removed; starting development recreates it. Installed dependencies, generated startup plans, source research/cache, historical reports, screenshots and all three flagged ADM fixtures were retained. Only the individually approved Finder metadata files were removed from dependency/Git folders.

## Space accounting

| Measure | Logical bytes | Approximate size |
|---|---:|---:|
| Approved candidate content removed before verification | 2,732,650,514 | 2.54 GiB |
| Required output regenerated and retained | 206,683,061 | 197.11 MiB |
| Reduction within approved candidate paths after rebuild | 2,525,967,453 | 2.35 GiB |

The duplicate backup pairs alone account for 2,334,689,044 logical bytes (2.17 GiB). These are logical file-size measurements, not a guarantee of physical free space returned on APFS. New small documentation and verification evidence are additional retained files and are not subtracted in this candidate-only comparison. No temporary dependency copy remains.

## Fresh verification

| Check | Result |
|---|---|
| Unit tests | **276 passed in 27 files** |
| Browser E2E | **18 passed**, desktop and mobile |
| Production builds | Root and `/ClassicCars` both passed from cleaned output |
| Strict TypeScript | `tsc --noEmit --incremental false` passed after rebuild |
| Release smoke | Setup twice, preserved password, migrations/native SQLite, backup/restore and API startup/shutdown passed with isolated state |
| Static browser verification | Both paths passed; zero runtime errors/missing local assets; real images loaded; root/subpath workspace isolation passed |
| Public inventory exports | All 48 public JSON files match both builds exactly (96 comparisons); 172 static files scanned, zero matches for the configured private credential |
| Database integrity | Active DB and all 17 retained backup DBs passed read-only `quick_check` |
| Protected data | All 262 protected files match pre-cleanup hashes, including 182 Low candidates, required backup copies, latest pair, `.env`, private DB and public JSON |
| SBOM | Three complete schemas and five declared manifest report hashes/input hashes passed offline |
| Release references | 13 Action commit references and Docker base digest passed |

Browser E2E and export verification ran from a temporary copy of source/public files with isolated backend state and fresh report paths. The private environment/database were not copied into it. The first sandboxed server start was denied, and an initial shared-dependency symlink was rejected by Turbopack. Tests were rerun with authorized local execution and an isolated dependency copy; all final checks passed. Temporary servers ended, fresh browser evidence was archived privately, and the temporary workspace/dependency copy was removed. Existing Low screenshots/reports were neither overwritten nor deleted.

The known SBOM native/bundled-report manifest gap and lifetime-attempt retry behavior remain documented future work. No code/dependency change or live provider/delivery acceptance is claimed. Docker deployment and the published website were not changed.

## Backup retirement map

The table records retired DB names and their retained byte-identical counterparts. Each matching `.env` was retired/retained together with its database. This mapping preserves the meaning of earlier dated recovery references.

| Removed DB | Retained DB |
|---|---|
| `backups/musclescout-2026-09-08T15-50-01-903Z.db` | `backups/musclescout-2026-09-08T03-18-53-092Z.db` |
| `backups/musclescout-2026-09-10T20-09-18-602Z.db` | `backups/musclescout-2026-09-08T17-29-49-526Z.db` |
| `backups/musclescout-2026-09-12T12-03-45-494Z.db` | `backups/musclescout-2026-09-10T23-06-01-089Z.db` |
| `backups/musclescout-2026-09-12T21-50-42-509Z.db` | `backups/musclescout-2026-09-12T12-40-08-380Z.db` |
| `backups/musclescout-2026-09-24T12-12-08-563Z.db` | `backups/musclescout-2026-09-12T21-55-02-977Z.db` |
| `backups/musclescout-2026-09-27T20-04-57-044Z.db` | `backups/musclescout-2026-09-24T13-01-44-858Z.db` |
| `backups/musclescout-2026-09-29T23-02-01-081Z.db` | `backups/musclescout-2026-09-27T20-45-02-890Z.db` |
| `backups/musclescout-2026-10-01T10-49-07-000Z.db` | `backups/musclescout-2026-09-29T23-42-46-277Z.db` |
| `backups/musclescout-2026-10-04T12-42-28-136Z.db` | `backups/musclescout-2026-10-01T11-30-19-226Z.db` |
| `backups/musclescout-2026-10-05T12-13-58-235Z.db` | `backups/musclescout-2026-10-04T13-24-17-136Z.db` |
| `backups/musclescout-2026-10-09T13-44-13-917Z.db` | `backups/musclescout-2026-10-05T12-26-21-919Z.db` |
| `backups/musclescout-2026-10-13T12-25-54-717Z.db` | `backups/musclescout-2026-10-09T14-27-34-563Z.db` |
| `backups/musclescout-2026-10-17T11-42-50-345Z.db` | `backups/musclescout-2026-10-13T13-10-18-987Z.db` |
| `backups/musclescout-2026-10-19T12-23-05-679Z.db` | `backups/musclescout-2026-10-17T12-27-46-396Z.db` |

The [machine-readable cleanup receipt](validation/cleanup-2026-10-20.json) lists each removed path, byte size, retained counterpart, regenerated output and verification result. Full before/after hashes and raw logs are private under ignored `data/reports/cleanup-2026-10-20/`. All changes remain uncommitted for review.
