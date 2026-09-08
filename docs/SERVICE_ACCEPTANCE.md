# Bounded routing and delivery acceptance

The acceptance commands default to readiness checks. They are separate from collection and queued-alert delivery. Missing credentials produce `blocked` with zero provider/message operations. A ready result means configuration is present; it does not prove that a provider accepted a request or that a recipient received a message.

Each invocation writes timestamped JSON under `test-results/private/`. This folder is ignored by Git and uses mode 0700 with reports mode 0600 on POSIX systems; on Windows, use an appropriately restricted user profile and filesystem ACL. Routing reports include the selected home city, geocoder evidence and provider geometry, so keep these reports private. Reports and console summaries omit Authorization headers, SMTP credentials and raw delivery destinations.

## Routing

Configure the user's ORS key in the private `.env` as `MUSCLESCOUT_ORS_KEY`, and finish `npm run setup`. A self-hosted or otherwise authorized Nominatim-compatible service may be configured through `MUSCLESCOUT_GEOCODER_URL`; the default is Nominatim's public endpoint. Configure a suitable contact with `MUSCLESCOUT_GEOCODER_CONTACT` when available. Provider terms, quotas and account access still apply.

Read the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/) before deliberately choosing its public service. It requires an identifying User-Agent, attribution and caching; the application-wide maximum is one request/second, and repeated scripts are limited to four/minute on one machine and one thread. Do not repeatedly force-refresh identical queries, use autocomplete, or send confidential personal data. This diagnostic uses city names, shared 15-second spacing and at most three geocodes. It is a manual acceptance check, not a scheduled job. The policy requires application developers to make an informed service choice and remain responsible for compliance.

```sh
npm run verify:routing
npm run verify:routing -- --live --fresh --wheaton
```

The first command sends no requests. The second explicitly requests up to three geocodes and two ORS routes: Wheaton IL to Milwaukee WI and Holland MI. Omit `--wheaton` to use the configured home city. `--fresh` asks the existing geocoder and route-cache implementations for current results; otherwise cached results are allowed and are labeled in the report. Redirects are rejected so the diagnostic does not hide additional requests.

The diagnostic reuses the application's geography leases, persistent service budgets, request timeouts, provider cooldowns and geocode/route caches. It validates US country/state/city evidence before routing and captures the ORS request options, observation time, duration, distance, raw summary and decoded geometry when returned. Routes must retain `avoid_features: ["ferries"]`, `avoid_borders: "all"` and `traffic: false`. The routes are city-level, non-traffic driving estimates. These calls never update vehicle ads or the saved home setting. They may update provider caches, leases and service-budget records.

`passed-provider-checks` establishes the response and provenance checks, not every geographic acceptance criterion. Inspect the captured Holland geometry for the land detour around Lake Michigan and record the actual route result. No expected driving duration is fabricated or hard-coded. A cache-only run cannot establish current ORS connectivity, and missing/ambiguous geography or quota failures remain blocked with the observed reason.

Primary references verified September 8, 2026: [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/), [ORS directions documentation](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/), [ORS routing options](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options), [ORS geometry decoding](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/geometry-decoding).

## One synthetic delivery digest

Configure a test destination the user controls and has authorized. Enable that channel through application settings. The script never enables a channel itself. Email requires `MUSCLESCOUT_SMTP_URL` and one plain address in `MUSCLESCOUT_EMAIL_TO`; `MUSCLESCOUT_EMAIL_FROM` is optional. Webhook requires `MUSCLESCOUT_WEBHOOK_URL` as an HTTPS URL on port 443 without embedded credentials. The normal safe-request layer rejects private/reserved webhook destinations and cross-origin redirects.

```sh
# Readiness only: sends no message.
npm run verify:delivery -- --channel=webhook
npm run verify:delivery -- --channel=email

# Only after the destination and channel have been intentionally configured:
npm run verify:delivery -- --channel=webhook --send-test
# Or, separately, for the opted-in email destination:
npm run verify:delivery -- --channel=email --send-test
```

Each send command attempts exactly one synthetic digest through the chosen channel. It reads settings and a separate `delivery-acceptance:` receipt, never the real Alert or DeliveryAttempt queues. The body has one synthetic test entry and no vehicle inventory, search matches, notes or queued alerts. The default stable test ID is `connectivity-v1`, combined with the channel and a hash of the destination. The digest ID is sent as the webhook idempotency key or the SMTP Message-ID/X-MuscleScout-Digest-ID, and persisted before the attempt. A repeated successful test ID is suppressed.

The command shares the `alert-delivery` lease and persistent service-budget implementation, with a bounded reservation (one second spacing, at most 100 synthetic attempts per destination service/day, at most ten seconds waiting). It reuses the application's SMTP transport limits and failure classifier, plus the 30-second SMTP deadline and normal safe HTTP request timeout. It schedules no automatic retries. SMTP/HTTP transport acceptance is reported as `accepted-by-transport`; inspect the destination and record exactly one receipt with the digest ID to finish end-to-end acceptance.

If a request times out, a process ends while sending, or receipt persistence fails after sending, the result is uncertain: the destination may already have the digest. Check the receiver before any manual retry. A prior attempt requires `--retry-test`; an uncertain attempt also requires `--acknowledge-uncertain`. The recorded retry interval must have elapsed. The same digest ID is reused; receivers are responsible for honoring webhook idempotency and mail systems do not universally deduplicate Message-ID.

```sh
# Explicit manual retry after reviewing the receipt and destination:
npm run verify:delivery -- --channel=webhook --send-test --retry-test
# If the prior outcome was uncertain, acknowledge the possible duplicate:
npm run verify:delivery -- --channel=webhook --send-test --retry-test --acknowledge-uncertain
```

Use `--test-id=operator-reviewed-label` only for an intentionally new test; a new label creates a new digest identity and can send another message. Do not rotate labels to bypass a failed or uncertain receipt. Ordinary delivery queue/dead-letter inspection and retry remains a separate application operation.

## Evidence from this implementation pass

The scripts were tested in an isolated source copy with injected transports: 15 tests passed, including no-key zero calls, check-only zero sends, channel opt-in and revocation while waiting, bounded routing, one synthetic digest, stable duplicate suppression, timeout uncertainty and lost receipt persistence. Strict TypeScript checking passed. Actual CLI readiness was run with provider/delivery environment values explicitly absent and dotenv pointed at an empty source; both produced blocked reports with zero request/send operations.

No real ORS key, delivery destination or SMTP transport was supplied during this implementation. No live route request or actual test message was sent. The current credential-dependent acceptance remains open until a user-authorized configured run and destination/geometry review produce evidence.
