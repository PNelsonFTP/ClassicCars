> Archived original backlog, before the 1.1.0 improvements. Current status is in [FUTURE_IMPROVEMENTS.md](../FUTURE_IMPROVEMENTS.md).

# Future improvements and unresolved struggles

Audited September 8, 2026 UTC against the current code, local database and dated research. These are open work items, not completed features. Site statuses below are the last observed conditions from the initial session, not fresh probes or ongoing monitoring. No new site requests or data edits were made during this documentation audit.

P1 means the next substantial reliability/coverage work; P2 means a valuable follow-on. Priorities reflect the personal shopping use case, not an assertion that the current app is unusable. Feature requests should preserve the existing shared search semantics, private data and explicit uncertainty.

## The cross-listing problem remains open

**The inventory contains 1,576 ads, not 1,576 proven distinct physical vehicles.** All ads currently have separate groups. No matching eligible strong keys were found, and no human deduplication review was performed across the full collection. This does not establish that duplicate cross-listings are absent.

| Read-only measurement at `2026-09-08T03:23:46Z` | Count |
|---|---:|
| Ads / current groups | 1,576 / 1,576 |
| Ads with an identifier / stock number | 54 / 147 |
| Ads eligible for the current strong-key rules | 141 |
| Repeated strong keys / automatic groups | 0 / 0 |
| Exact normalized-title/model/year candidate pairs | 23,963 |
| Candidate pairs across sources / within one source | 1,156 / 22,807 |
| Ads participating in at least one weak pair | 1,434 |

The candidate-pair counts measure **lookalikes**, not confirmed duplicate cars. Many classic ads have generic identical titles such as a year, make and model; unrelated cars then pair within the same marketplace. Real crossposts with different titles may never be suggested. Counting these pairs as duplicates or subtracting them from inventory would be wrong.

Current automatic grouping uses a compatible modern complete identifier, a narrowly supported 1965–1969 Mustang historical format, or normalized dealer name plus exact stock/model/year. It preserves older identifiers without pretending every historical format is decoded. Partial IDs, repeated badges, titles and photos do not establish authenticity. Most marketplace records are still catalog observations; missing seller/stock/identifier evidence limits matching. There is no dealer-alias registry or general stock normalization.

The review algorithm compares pairs quadratically and the UI displays only its first 15 suggestions, with no pagination, ranking or persistent dismissal. The merge API accepts explicit ad IDs and stores the prior group identities; simple merge/unmerge retains source ads, histories and personal state. Overlapping/nested reversals need additional testing. Evidence: [shared search](../shared/search.ts), [store](../server/store.ts), [group endpoints](../server/api.ts), [review UI](../components/WorkspaceTools.tsx).

### P1-01 — Evidence-ranked vehicle reconciliation

**Current workaround:** retain every source ad, compare source details manually, merge only after review and keep the reason. Use the ad count as the count of advertisements.

**Next work:** enrich permitted details for identifiers and dealer stock; retain raw values while adding auditable dealer aliases and conservative stock normalization. Generate candidates using indexed model/year blocks and corroborating attributes. Add side-by-side source evidence/conflicts, confidence explanations, pagination, manual selection, dismiss/undo and persistent review decisions. Photo similarity can assist review only if lawful image handling is established; it must not automatically prove sameness.

**Acceptance:** a labeled same-car/different-car dataset measures precision/recall; conflicting identifiers never auto-merge; all candidates are reachable; every source URL and price remains visible; arbitrary tested merge/unmerge sequences preserve history, notes and favorites. Group counts must stay explicitly distinguishable from verified unique cars.

### P1-02 — Cross-post and group-aware alerts

**Struggle:** saved-search baselines currently use source-ad IDs. A new crosspost or a change in a grouped search's representative can create another new-match event for the same physical car. Existing alert idempotency prevents repetition of the same recorded event, not all vehicle-level duplicate notifications.

**Next work:** define separate vehicle-level versus ad-level alert policies, carry stable group identity through transitions, show the newly discovered source without fabricating a newly discovered car, and avoid treating differing crosspost asks as a single verified price change.

**Acceptance:** crosspost arrival, regrouping, unmerge and representative/sort changes produce the chosen alert behavior exactly in regression fixtures; source-level histories remain intact and the initial baseline stays quiet. Evidence: [alerts](../server/alerts.ts), [search grouping](../shared/search.ts).

## Blocked, restricted and incomplete sources

An HTTP block, a policy restriction, missing API credentials and an unvalidated parser are different problems. Keep those causes distinct in the UI/run history. Robots permission alone does not override restrictive terms; an accessible search snippet is not a live inventory observation. No cookies, proxy rotation, login automation or challenge bypass was used.

| Source / last observed obstacle | Current handling | Appropriate next step |
|---|---|---|
| **500 Classic Auto Sales:** later inventory and representative detail return HTTP 403; pagination includes a challenge-associated POST | Three initial card observations retained; current refresh blocked; details not fetched through a bypass | Authorized dealer feed/export or a permitted ordinary access path; persistent cooldown before any recheck |
| **Autotrader:** initial Mustang catalog/detail worked; later HTTP 200 page is an unavailable template with missing expected state; storage/redistribution restrictions also apply | Nineteen records preserved locally; public snapshot excludes them; latest run can be `partial` with a failed page, not necessarily labeled `blocked` | Authorized access/feed or a later policy-compliant public recheck; validate other models and nationwide pagination separately |
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

The last seven successful production inventory parsers were **ClassicCars.com, Volo, GR Auto Gallery, American Dream Machines, Midwest Muscle Cars, North Shore Classics and J & S Motors**. They also have unfinished work:

| Source | Remaining work |
|---|---|
| ClassicCars.com | Initial 25 configured catalog pages yielded 1,387 ads and 31 detail observations. Most details remain; some remote location claims do not establish actual stock location. Validate national queries and resume deeper work. |
| Volo | Fifty target ads across two catalog pages; bounded detail enrichment incomplete. Retain rental exclusions and distinguish actual status from hidden generic waitlist text. |
| GR Auto Gallery | Forty-four ads across five pages; incomplete detail/branch location evidence and later specialty claims. Reconcile branch/dealer aliases with crossposts. |
| American Dream Machines | Thirty-four target ads across four pages; incomplete detail evidence and some unknown/call-for-price asks. Preserve own-car fields when similar ads appear in the page. |
| Midwest Muscle Cars | Its configured sale page and all three target details were checked; routes still unavailable. “Complete” describes that scope only. |
| North Shore Classics | Twelve catalog ads; one actual public HTML detail endpoint verified, eleven details remain from that initial scope. The earlier empty shell was not valid enrichment. |
| J & S Motors | Twenty-four catalog ads, mostly pending detail enrichment. Keep zero placeholder offers out of asks/history and infer sold only from the correct ad's evidence. |

Detailed request dates, access-policy links and source counts are in [SOURCE_COVERAGE.md](../SOURCE_COVERAGE.md), [dealer research](../docs/DEALER_RESEARCH.md) and [marketplace research](../docs/MARKETPLACE_RESEARCH.md). Those research reports are historical evidence; the latest run drives current application health. No blocked source is a verified zero-inventory source.

### P1-03 — Durable pagination and enrichment queues

**Struggle:** each collection rebuilds an in-memory catalog queue from its starting URLs. Per-source caps span all configured queries. Repeating a one-page or default capped run can revisit early pages indefinitely. Detail attempts now rotate by attempt time and skip fresh details, but only among ads rediscovered in that run. Per-run `remainingEnrichment` is not a cumulative source-wide backlog.

**Current workaround:** deliberately choose suitable page/detail caps for a bounded permitted run and read its scope/counts. Do not assume repeated smoke runs eventually cover the entire source.

**Acceptance:** persistent source/query/scope checkpoints and detail queues make repeated one-page/one-detail runs eventually traverse and enrich a multi-page fixture; restart safely resumes; national/regional work is distinguished; current, total and blocked backlog are visible; failed pages never imply removal. Evidence: [collector](../server/ingest/collector.ts).

### P1-04 — Access-health history and cooldowns

**Struggle:** source isolation and stopping on access failures work, but persistent circuit breakers, shared request budgets, `Retry-After` handling and a manual re-enable policy are absent. A running daily worker can revisit unchanged access problems.

**Acceptance:** typed policy/access/layout/network errors, persisted cooldowns, visible next permitted check, bounded 429/5xx retry, and a pause/review path for 403 or policy restrictions. One denied source must not stop healthy sources; no burst of retries or authentication bypass is allowed. A successful permitted smoke run is required before describing a repaired adapter as live-validated.

## Geography and service limits

### P1-05 — Actual road routing and consistent freshness

No ORS key was supplied, so no road route was obtained. Sixteen current ads have coordinates, but this alone does not place them within four hours. The adapter has been tested through its missing-key path and a fake provider; request options, real response interpretation, quota failures and provider-specific behavior still need live verification.

A code-audited gap also remains: the ORS provider cache uses a fixed 30-day TTL while search/job freshness is configurable. A shorter freshness setting can keep receiving the provider's older cached result. Request spacing is process-local and has no persistent daily budget.

**Acceptance:** with user-supplied authorized credentials, run a small bounded set including a Lake Michigan detour; verify driving distance/duration, non-traffic basis, ferry/border options and attribution. Cache policy must honor caller freshness and changed origin/destination/options. Test exact 240 minutes, expired/future results, quotas and failures without substitute speed formulas. Evidence: [geography](../server/geography.ts), [routing references](../docs/REFERENCE_RESEARCH.md).

### P1-06 — Geocoder fairness, provenance and shared limits

Geocoding is deliberately explicit, cached and throttled. However, existing ambiguous records can be counted again against each processing limit without making progress, starving later locations. There is no database lease across geocoder processes; the cache has no explicit review/expiry workflow, and a single unique coordinate result is accepted without validating all returned address fields.

**Current workaround:** run only one bounded geocoder, resolve missing actual stock locations from permitted detail evidence, and correct ambiguous locations explicitly. Do not substitute dealer headquarters for an off-site vehicle.

**Acceptance:** unresolved entries go to a review queue without consuming every future run; missing records progress under small caps; returned country/state/feature evidence is retained and validated; cross-process limits are shared; cache retry/invalidation is deliberate. A private/compatible provider can replace public Nominatim for larger workloads after its terms and setup are verified.

## Additional product and engineering work

| ID / priority | Current struggle | Proposed work and acceptance criteria |
|---|---|---|
| P2-01 — Snapshot aging | Backend reads project stale status at read time; exported availability is frozen at snapshot creation | Include stale policy and original availability separately; evaluate snapshot age consistently in the browser and test clock boundaries. A stale export must not look freshly checked. |
| P2-02 — Review provenance | Source/user evidence exists locally, but history UI/API expose ask/bid/availability only; the legacy location endpoint has less audit detail | Add source-versus-user review timeline, correction reset/reason/date, and consistent audit records. Recompute derived model/generation metadata after reviewed year changes; verify refresh preserves overrides. |
| P2-03 — Job operations | One coalescing setting holds collection demand; no job IDs/cancel UI or OS autostart; stopped/partial outer cycles can advance schedule time | Add durable jobs and explicit partial-cycle scheduling, cancellation, recovery and optional local service setup. Test shutdown without losing pending work. |
| P2-04 — External alerts | No real webhook/SMTP destination configured; no messages sent; SMTP timeouts/dead-letter UX are incomplete | Use an opted-in test destination, bounded connection/socket timeouts, stable receiver deduplication, visible failure/retry state and manual dead-letter retry. Verify quiet first baselines and uncertain-send behavior. |
| P2-05 — Specialty breadth | Eight later Mustang observations are seller claims; no supported later specialty match is established | Expand only permitted specialty-specific discovery, add reviewed documentation, retain tribute/clone distinctions and reverify the manufacturer year ceiling with a dated source. Keep common filters and geography independent. |
| P2-06 — Auction breadth | No dedicated auction source integrated; one ClassicCars auction ad has unknown phase/bid/end | Add only an authorized feed; validate bid/ask/buy-now/fees, reserve/outcome, timezone and end transitions, with suitable freshness. Do not treat an unknown phase as live. |
| P2-07 — National coverage | Broader configuration and queueing exist; full national collection has not run | Validate remote filters and terminal pages by source using durable progress; publish coverage by scope. Broad dealer inventory does not prove national completeness. |
| P2-08 — Image availability | Original source images can disappear or deny hotlinks | Preserve clear fallbacks, exact ad/image association and attribution; use licensed storage only if permitted. Never replace a missing car photo with a different vehicle. |
| P2-09 — Scale and maintainability | Browser/API/alerts load all rows; duplicate matching is quadratic; UI is large; snapshot ships the full dataset | Add indexed candidate matching, measured pagination/virtualization, smaller UI modules and typed API contracts. Keep browser/API/alert parity at a defined national-scale benchmark. |
| P2-10 — Cross-platform release | Node 24, Windows launcher and Docker supplied but not executed here; Docker static web holds build-time JSON | Test clean installation, migrations, native packages, startup/shutdown and backup/restore on the target matrix. Refresh Docker's static image explicitly or use connected mode. |
| P2-11 — Hosting and browser connectivity | Root/subpath local exports pass; real Pages/HTTPS-to-private-backend and WebMCP unsupported context remain unverified | Test an authorized deployment/HTTPS endpoint and browser network restrictions; verify feature registration/lifecycle in a supported WebMCP context. No publication without a supplied destination and authorization. |
| P2-12 — CI and supply chain | Workflow runs only on manual publication; Actions/base image use mutable major/tag references; no initial Git commit yet | Establish a reviewed initial commit/tag, CI for unit/browser/static/restore checks, immutable reviewed action/image pins and target-container SBOMs. Keep dependency updates scoped and remove overrides only after verified upstream fixes. |
| P2-13 — SBOM platform gap | npm lock-only export cannot resolve four bundled optional-WASM edges; host SBOM and full lock inventory are delivered | Generate SBOMs in clean target builds, inspect bundled/native artifact versions, add schema validation tooling and compare SBOM changes in CI. Do not infer unobserved versions. See [SBOM](../SBOM.md). |

## Suggested implementation order

1. Add durable collection progress and permitted detail enrichment, alongside access cooldowns. This supplies better evidence for both travel and cross-listing review.
2. Fix geocoder progress/cache behavior, then validate ORS with a supplied key and representative road trips.
3. Build ranked, fully navigable duplicate review and group-aware alert policies using a labeled evidence set.
4. Improve provenance, snapshot aging, job operations and external-alert validation.
5. Expand permitted specialty/auction/nationwide sources and validate the intended deployment/platform with CI and target SBOMs.

Resolved implementation struggles are documented separately in [IMPLEMENTATION_LOG.md](../IMPLEMENTATION_LOG.md), so future maintainers can preserve those fixes rather than mistaking every historical failure for an open blocker.
