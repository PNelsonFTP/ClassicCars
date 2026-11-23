# November 23 browser verification follow-up

The first GitHub browser run passed 19 of 20 tests. Its mobile workspace smoke test expected the empty-results heading while the captured page already showed the loaded inventory and 487 nearby ads. The readiness assertion depended on a transient page state. The test now waits for an actual result card, with a bounded 30-second allowance for loading the public catalog, before exercising review, notes, shortlist and persistence.

All 20 desktop/mobile checks passed locally with the corrected result-readiness assertion. Application code, dependencies and inventory were unchanged by this test correction. The original failed log and trace are retained privately under `data/reports/refresh-2026-11-23/ci-browser-artifact/`; the first CI run is [45188534343](https://github.com/PNelsonFTP/ClassicCars/actions/runs/45188534343).

Live verification also needed an explicit historical-record filter: Volo now reports ad 19445 sold, while its predecessor is an older observation. The live check selects older observations to inspect the preserved link and both grouped source links, then restores the recent-inventory filter. Seller-reported sold status is preserved. All public JSON hashes, live search, images, city/ZIP controls, driving filters and desktop/mobile layouts passed, with no runtime errors or missing site assets.

Final CI and deployment results are recorded in [delivery status](../DELIVERY.md).
