# Integrated state integrity audit

Audit and integrated corrections completed September 8, 2026. Reproductions used synthetic ads, a disposable SQLite database and a temporary export directory. No live source or delivery service was used by this audit.

All eleven focused regressions are integrated into the project and pass in the full unit suite. Eight original reproductions failed before the corrections. Root TypeScript and browser review/reset checks also pass. This is the final implementation record; no patch application is required.

1. **Same-address detail refresh erased validated coordinates/routes.** The old code compared full raw and enriched location objects. A parser repeating the same city/state therefore appeared to move the vehicle. A new `mergeVehicleGeography` helper compares actual address/input facts and preserves derived evidence when those facts have not changed.
2. **A changed catalog location retained a route for the old city.** Invalidation previously happened only for detail parsers. Every effective vehicle-location change now invalidates the old route and straight-line distance.
3. **New raw seller location unnecessarily erased a route to an unchanged reviewed location.** Effective user-reviewed location and raw source location now remain separate. Raw source changes still update the reset baseline while the established reviewed route remains valid.
4. **Replay erased automatic groups created after the first review baseline.** Non-reviewed assignments now synchronize into the replay baseline before each mutation.
5. **Replay resurrected an automatic-group member detached for conflicting evidence.** The synchronized baseline retains that detachment.
6. **Undo could restore an obsolete automatic subgroup hidden inside an active reviewed group.** Original automatic subgroups are checked for current identifier/model/year contradictions before replay. Contradictory automatic relations are cleared conservatively; explicit active review links remain governed by the user's review history.
7. **Public evidence leaked private identifiers, contact values and review notes.** Shared public redaction now strips private identifier/contact/feed evidence keys, sanitizes textual contacts, and removes user-reviewed notes from both field and specification evidence. Private source records and overrides remain excluded.
8. **Feed expiry was checked only at import.** Canonical evidence now retains `feed.authorizationExpiresAt`; public inventory/image export reevaluates it at the export clock boundary. Legacy feed records lacking that expiry assertion remain local until an explicit current manifest is imported. A null expiry is an explicit non-expiring assertion.
9. **Superseded public detail chunks survived permission/content changes.** After writing the new catalog, export prunes only its own 24-hex `.json` detail files absent from the current manifest. `exportSnapshot(outputDirectory = "public/data")` supports an isolated test destination while existing callers retain their normal behavior.
10. **Editing another reviewed field replaced an earlier correction's reason/date.** Individual year/specialty evidence is now stamped only by a correction of that field and survives later source refreshes. Reset also recomputes generation for the restored year/model.
11. **A derived update could fabricate a source baseline for a legacy correction.** Incoming reviewed/projected rows without a true baseline no longer become their own source record. A subsequent actual source observation can establish the missing baseline; reset stays safely unavailable until then.

These are regression and state-integrity measurements, not validation of real-world vehicle identity or successful live SMTP/routing/feed integrations.
