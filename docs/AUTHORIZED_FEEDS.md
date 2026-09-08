# Authorized feeds and specialty/auction discovery

The feed importer supports dealer-provided exports, licensed provider feeds and permissible user-owned records. It does not obtain permission, turn disabled scraping adapters on, or establish new live inventory merely because its fixtures pass.

Start from `config/authorized-feed.example.json`, which intentionally contains no vehicle records. Fill its permission reference, source identity, original observation timestamps, scope/query, exact listing/image host allowlists and pagination metadata. Publication and image redistribution default to false. Keep actual agreements and feed files private under `data/feeds/`.

```sh
npm run import:feed -- data/feeds/provider-page.json
npm run import:feed -- data/feeds/provider-page.json --apply
npm run export:snapshot
```

The first command validates without changing the database. Applying requires all rows on the page to validate, preserves source observation times and uses an idempotent file receipt. Linked cursors are tracked per feed/query/scope. A terminal page only completes a continuous declared query, and absence never removes an existing ad. Public export additionally enforces each imported listing's permission flags.

Each row identifies a whole vehicle and its exact source ad. Price fields are independent: an auction has no asking price; current bid, buy-now, reserve state, buyer premium, disclosed fees, outcome and UTC-offset timestamp are preserved separately. Unknown auction phase remains unknown. An ended auction does not imply a sale. End time requires an explicit timezone offset; display timezone is retained separately. Currency is never silently converted.

Specialty keywords create seller claims, while clones, replicas and tributes remain labeled. `document-supported` specialty identity requires a document reference. The checked Ford announcement explicitly identifies a 2027 Mustang GTD; this supports the current family ceiling without asserting every trim is available or inferring more model years from a multi-year application window. [Ford's dated announcement](https://www.fromtheroad.ford.com/us/en/articles/2026/mustang-gtd-applications-open-april-17)

`config/specialty-discovery-plan.json` supplies separate Cobra, Shelby GT350/GT500, Mach 1, Boss and GTD queries for a permitted provider. These discovery branches do not bypass common price, year, text, specifications or geographic filters. National scope is recorded explicitly and remains separate from regional checkpoints; exhaustive provider/query traversal is not proof of national completeness.

## eBay Browse path

`server/ingest/ebay-browse.ts` includes a bounded request builder, strict same-query pagination, whole-vehicle category/parts checks, conservative auction mapping and an explicit one-page API function. Its tests use synthetic fixtures, not observed eBay vehicle inventory.

Live requests require an approved provider agreement reference, a user-supplied application token and a dated review of the applicable whole-vehicle leaf categories. Current production eligibility depends on eBay approval and agreements; possession of a token alone does not establish the intended use is approved. No approval application or account change has been submitted. [eBay Buy API requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html)

Browse exposes fixed price, best offer, auction and classified-ad buying options. Its buying-options filter must be combined with leaf-category evidence, and the item's country filter is distinct from shipping destination. Keep the API values separate and validate auction start/end behavior with an approved small live sample. [eBay field filters](https://developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html)

No numeric leaf categories are invented or hardcoded as universally valid. Categories differ by marketplace and change over time; obtain the EBAY_US category tree/version and verify whole-car leaves using Taxonomy before enabling live collection. Parts fitment support is not proof of whole-vehicle inventory coverage. [eBay category guidance](https://developer.ebay.com/api-docs/buy/static/buy-categories.html)

The API function does not retry credentials/access/quota errors or seek alternate identities. Any scheduled integration must use the shared persistent request budget, source health and job/checkpoint machinery. Tokens stay in request headers and never enter listing URLs, output files, public data or receipts. Live whole-car coverage, quotas, terminal pages and approved redistribution remain pending until credentials and permission are supplied and tested.
