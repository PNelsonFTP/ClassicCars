# Future improvements and acceptance status

Updated September 12, 2026 (America/Chicago) for **MuscleScout 1.1.0**. The software changes for all 19 original items are implemented. Several real-world acceptance checks remain open because they require credentials, source permission, manual launcher/autostart checks or target-environment validation. [Delivery status](docs/DELIVERY.md) records the approved final publication and remote checks. The original requirements remain available in the [archived backlog](docs/FUTURE_IMPROVEMENTS_BASELINE.md); the [implementation map](docs/IMPROVEMENTS_STATUS.md) links every item to code, tests and remaining limits.

## September 12 data follow-up

The **September 12, 2026 refresh** retains **3,276 ads / 3,254 groups**, including **3,257 public ads**. It added **79 ads**, observed **47 numeric asking-price changes** (37 decreases, 10 increases), and refreshed details for **226 distinct ads**. All accessible configured catalogs completed: 25 regional and 49 national ClassicCars pages plus 20 dealer pages, with no catalog failures or cache hits. Five dealer detail queues are fully fresh; J & S Motors has 22 refreshed details and two older URLs returning 404. ClassicCars completed its configured 50-detail batch; 3,026 details remain due, rather than blocked by the daily budget. Autotrader and 500 Classic remain paused without new requests. See the [dated comparison](docs/validation/refresh-2026-09-12-comparison.md) for original observation dates and exact limits. Ads and groups are not verified unique physical vehicles; strict four-hour matches still require actual road routes.

The two missing J & S Motors detail pages retain their prior ads and blocked detail tasks; HTTP 404 is not treated as proof of a sale. Cross-listing review remains open. Older detail observations remain dated, and this bounded refresh does not claim a full detail-page or market census.

## September 10 data follow-up

The [dated refresh](docs/validation/refresh-2026-09-10-comparison.md) added 58 ads and newly observed details for 1,045 distinct ads. All six active dealer detail queues are fresh and complete. ClassicCars has 870 newly observed details; its remaining work is paused at the configured 1,000-request daily limit. 500 Classic and Autotrader remain paused, and restricted or disabled sources remain uncollected. The final ClassicCars queue has 2,132 due tasks and one deferred retry; three auctions observed earlier in this run are already due again under their one-hour detail policy. Grouping, seller claims, external credentials and the remaining operational acceptance still require the work described below.

## Implemented improvements

| Original ID | Delivered behavior | Remaining acceptance or operational work |
|---|---|---|
| P1-01 | Indexed evidence ranking, conflicts, reviewed dealer aliases, conservative stock normalization, paginated/manual duplicate review, dismiss/undo and merge-history replay | Enrich and review actual crossposts; synthetic accuracy is not a market accuracy estimate. |
| P1-02 | Vehicle/ad alert policies, optional source-added alerts, quiet baselines and source-specific price histories | Confirm real groups through evidence; grouping cannot authenticate a car. |
| P1-03 | Durable source/query/scope pagination and independent source-wide detail queues; restart resumes bounded work | Run the outstanding permitted collection; current remaining detail work is measured in the dated refresh report. |
| P1-04 | Typed failures, persisted budgets, Retry-After/cooldowns, review pauses and fresh smoke recovery | Existing blocks and restrictions remain; later recovery requires dated permitted live validation and preserves failure history. |
| P1-05 | Caller-controlled route freshness, input signatures, shared quotas and reviewed-location invalidation | Authorized ORS key and bounded real Lake Michigan detour/provider checks. |
| P1-06 | Fair geocoder attempts, ambiguity review, explicit cache retry, validated address evidence and shared leases | Review unresolved real locations; validate any replacement provider in its target environment. |
| P2-01 | Browser/API availability aging from original observations, with auction phase and freshness rules | Old snapshots remain dated; periodically regenerate approved public data. |
| P2-02 | Source/user provenance timeline, reason/date, reset to retained source baseline and generation recomputation | Legacy corrections without a retained raw baseline need a fresh source observation before reset. |
| P2-03 | Durable job IDs, cancel/retry/recovery, partial scheduling and optional OS startup installer | Templates generated only; OS startup was not installed. |
| P2-04 | Frozen digests, stable delivery IDs, bounded SMTP timeouts, failure/uncertain/dead-letter UI and audited retry | An opted-in real destination and send/receipt verification. |
| P2-05 | Permission-aware specialty imports, documentary references, separate discovery plan and dated 2027 Ford ceiling | Obtain permitted supported specialty observations; seller claims remain unverified. |
| P2-06 | Authorized feed ingestion, bounded eBay Browse adapter, auction money/time/phase semantics | Approved live auction access, production category evidence and actual collection. |
| P2-07 | Scope-preserving pagination, terminal-page provenance and per-scope coverage reports | The configured ClassicCars catalog graph was traversed; wider national coverage and independent remote-filter acceptance remain unverified. |
| P2-08 | Exact-ad image fallback/retry and attribution; feed image permission/expiry enforcement | Remote images may still disappear; licensed image storage requires permission. |
| P2-09 | Compact dictionary catalog, lazy per-ad details, bounded rendered pages, indexed duplicate candidates, typed API and split UI modules | Remaining all-match retention/rescans and dense candidate buckets are detailed below. |
| P2-10 | Clean Node 24 macOS and Linux Docker builds; isolated setup/migration/SQLite/restore/startup checks; CI platform matrix | Native GitHub CI passes Node 24 on Linux/Windows/macOS and Node 22.18.0 on Linux. Windows double-click launcher and Docker Compose deployment remain separate checks. |
| P2-11 | Native Chromium WebMCP registration/lifecycle checks, root/subpath exports and live GitHub Pages publication | Browser access from the public HTTPS site to a private backend remains a separate acceptance check. |
| P2-12 | Initial local commit, release workflow, immutable direct Action/base-image pins, dependency updates and SBOM diffs | See [delivery status](docs/DELIVERY.md) for remote CI/publication; runner/apt inputs remain mutable. |
| P2-13 | Full offline SBOM schema/hash validation, host/container native+OS inventories and exact optional-WASM manifest inspection | Windows target SBOM/native artifacts are captured in CI; deeper embedded native/Rust component inventories remain open. |

## The cross-listing problem remains open in the real inventory

**The September 12 inventory has 3,276 ads and 3,254 groups; these are not verified unique physical vehicles.** The initial collection had 1,576 ads before the final catalog refresh. No human review has reconciled the whole collection. Most ads still lack complete seller/stock/identifier evidence. Initial read-only analysis found 23,963 same-title/model/year lookalike pairs, including 1,156 across sources; those historical counts were produced by the old weak algorithm and are not current ranked suggestions or confirmed duplicates.

The new candidate index requires corroboration and presents conflicting identifiers rather than automatically merging them. Reviewed aliases and conservative stock normalization retain raw evidence. Every original source URL, asking-price history, favorite and note survives grouping. Overlapping merge/undo sequences have regression coverage. A small labeled synthetic set measured candidate precision 0.75 and recall 1.0; it is a regression fixture, not evidence of production matching accuracy. No photo-similarity identification was introduced without appropriate image rights.

The next useful data work is permitted detail enrichment followed by evidence-based review. Group counts must remain labeled as groups, and source-ad asks must not become a fabricated single vehicle price trend.

## Blocked, restricted and incomplete sources

An HTTP block, a policy restriction, missing API credentials and an unvalidated parser are different problems. Keep those causes distinct in the UI/run history. Robots permission alone does not override restrictive terms; an accessible search snippet is not a live inventory observation. No cookies, proxy rotation, login automation or challenge bypass was used.

| Source / last observed obstacle | Current handling | Appropriate next step |
|---|---|---|
| **500 Classic Auto Sales:** later inventory and representative detail return HTTP 403; pagination includes a challenge-associated POST | Three initial card observations retained; current refresh blocked; details not fetched through a bypass | Authorized dealer feed/export or a permitted ordinary access path; persisted access-review pause; an authorized ordinary smoke check is required before recovery |
| **Autotrader:** initial Mustang catalog/detail worked; later HTTP 200 page is an unavailable template with missing expected state; storage/redistribution restrictions also apply | Nineteen records preserved locally; public snapshot excludes them; historical failed-page evidence now seeds an explicit access-review state | Authorized access/feed or a later policy-compliant public recheck; validate other models and nationwide pagination separately |
| **Classics on Autotrader:** direct access returned 403 | Disabled; kept separate from main Autotrader | Approved feed/access or later permitted ordinary recheck |
| **Hemmings:** 403 and relevant path/AI-agent restrictions; no approved feed license | Disabled; named robots feed exception is not assumed to grant access | Obtain authorized feed/license |
| **Craigslist Chicago and surrounding boards:** collection restricted by terms absent permission | No automated inventory collection; region names do not imply coverage | Licensed access or user's own permissible records; keep surrounding boards explicitly uncollected |
| **eBay Motors:** approved API credentials needed; whole-vehicle coverage untested | No HTML scraping or invented auction stock | User-supplied approved API access; verify whole vehicles, buying options and pagination |
| **Cars.com:** needed filtered search/detail access restricted; direct robots fetch also returned 403 | Disabled | Approved feed/permission |
| **CarGurus:** public all-year catalog accessible, but classic/location filters, current details and pagination unvalidated; retention restrictions need review | Disabled/incomplete; not falsely blocked by an unrelated legacy URL rule | Resolve permitted use, then validate the actual current target workflow |
| **Bring a Trailer:** terms restrict scraping/aggregation | No auction collection despite public homepage access | Licensed feed/permission or permissible user-owned observations |
| **Cars & Bids:** direct homepage returned 403 | Disabled, no challenge workaround | Authorized access/feed or a later permitted recheck |
| **Mecum:** automated collection requires prior permission | Disabled | Written permission/feed arrangement |
| **Barrett-Jackson:** general crawler paths disallowed | Disabled | Authorized feed or permission |
| **CorvetteForum:** AI-agent restrictions; vehicle-vs-parts and sale-state parsing unvalidated | Disabled | Approved feed; if permitted, establish classification and pagination fixtures |
| **Vintage Mustang Forums / Team Camaro:** explicit AI-agent restrictions | Disabled | Approved feed or user's own permissible records |
| **Facebook Marketplace:** intentionally manual-only; no authenticated collection attempted | Manual entry/import available | Map a user-supplied permitted export if one is provided; retain manual-only scope |
| **JWS Classics:** catalog responds, advertised detail page returns HTTP 500 | Incomplete; no invented price/details or zero-stock claim | Wait for site repair or obtain dealer-provided inventory export |
| **Duffy's Classic Cars:** inventory returns HTTP 403 | Disabled; snippets are not imported | Approved dealer feed/export or permitted access recheck |
| **indyauto.com:** observed landing page was not usable dealer inventory | Unsuitable research candidate | Verify a genuine replacement source before adding it |

The following table preserves the **September 8 backlog before the September 10 refresh**. Current source totals and due/blocked queues are in the [September 10 comparison](docs/validation/refresh-2026-09-10-comparison.md); all six active dealer queues were freshly completed.

| Accessible source | Retained ads | Previously completed detail records | Pending detail enrichment |
|---|---:|---:|---:|
| Midwest Muscle Cars | 3 | 3 | 0 |
| ClassicCars.com | 2,944 | 34 | 2,910 |
| Volo | 50 | 1 | 49 |
| GR Auto Gallery | 46 | 1 | 45 |
| American Dream Machines | 38 | 5 | 33 |
| North Shore Classics | 12 | 1 | 11 |
| J & S Motors | 24 | 2 | 22 |

The September 8 final scan fetched 93 fresh pages: 45 across the regional/broad dealer scopes and 48 further national ClassicCars pages. The national checkpoint retains 51 observed pages including the earlier three-page check. All discovered accessible catalog tasks were exhausted; this is not proof of all US inventory or independent acceptance of every remote filter. No detail request was made during this catalog-only pass. The [scan report](docs/validation/inventory-full-scan.json) and [scope report](docs/CONFIGURED_SCOPE_VALIDATION.md) retain original timestamps and remaining queues.

Detailed request dates, access-policy links and source counts are in [SOURCE_COVERAGE.md](SOURCE_COVERAGE.md), [dealer research](docs/DEALER_RESEARCH.md) and [marketplace research](docs/MARKETPLACE_RESEARCH.md). Those research reports are historical evidence; the latest run drives current application health. No blocked source is a verified zero-inventory source.

## Remaining engineering and operational work

The 50,000-ad [benchmark](docs/validation/scale-50000.json) passed 16 full/compact/decoded/API-core search and alert-membership parity scenarios. Packed JSON was 61.23% smaller than full synthetic JSON. Indexed matching compared 22,500 candidate pairs rather than the 1,249,975,000 all-pairs upper bound. The harness retained multiple representations and sampled about 2 GB resident memory; it did not measure SQLite disk, HTTP throughput or a browser rendering 50,000 records.

API database reads use 500-row batches and source/favorite indexes, but sorting/grouping still retains all matches and rescans on subsequent page requests. Dense identity/stock/title candidate buckets can still become quadratic. Further optimization should use a tested group-aware top-K/result cache keyed by data revision, filters, workspace and evaluation clock; preserve representative selection, exact counts and shared alert semantics. These bounds remain explicit rather than hidden behind pagination.

The public GitHub native matrix now passes Node 24 on Linux, Windows and macOS and Node 22.18.0 on Linux; the container build/release job passes too. Live Pages and the executed platform evidence are linked in [delivery status](docs/DELIVERY.md). Windows double-click launcher/autostart and Docker Compose deployment remain separate manual/environment checks; the executed matrix does not prove every architecture. The Docker static UI contains build-time JSON and needs an explicit refresh/rebuild or connected mode. OS autostart remains optional and was not installed.

Routing, live feed import and external delivery readiness tools report missing inputs without making calls or sending messages. Store credentials only in the private `.env`. Use a permitted export/API agreement for restricted sources; an operational review cannot grant collection rights. No source block was bypassed and no external message was sent. The user approved delivery after local review; actual publication is tracked in [delivery status](docs/DELIVERY.md).

See [HANDOFF.md](HANDOFF.md), [VALIDATION.md](VALIDATION.md), [Operations](docs/OPERATIONS.md) and [SBOM.md](SBOM.md) for exact commands, evidence and restart instructions.
