import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { catalogListing, packCatalog, unpackCatalog } from "../shared/catalog";
import { searchListings, matches } from "../shared/search";
import { projectFreshness } from "../shared/freshness";
import { rankDuplicateCandidates } from "../shared/duplicates";
import { evaluateAlertPolicy } from "../shared/alert-policy";
import { searchPageFromBatches } from "../server/search-page-core";
import type { Listing } from "../shared/schema";
import {
  BENCHMARK_NOW,
  scaleFixture,
  scaleQueries,
  scaleWorkspace,
} from "../tests/helpers/scale-fixture";
const args = process.argv.slice(2),
  count = Number(
    args.find((a) => a.startsWith("--count="))?.split("=")[1] || 50000,
  ),
  output = args.find((a) => a.startsWith("--output="))?.slice(9);
if (!Number.isInteger(count) || count < 100 || count > 250000)
  throw new Error(
    "Benchmark --count must be an integer between 100 and 250000.",
  );
const gc = () => (globalThis as typeof globalThis & { gc?: () => void }).gc?.();
const rounded = (n: number) => Math.round(n * 100) / 100;
const digest = (ids: string[]) =>
  createHash("sha256").update(ids.join("\n")).digest("hex");
const signature = (rows: { id: string }[]) => digest(rows.map((l) => l.id));
const jsonArrayBytes = (rows: unknown[]) =>
  2 +
  Math.max(0, rows.length - 1) +
  rows.reduce<number>(
    (total, row) => total + Buffer.byteLength(JSON.stringify(row)),
    0,
  );
const started = performance.now(),
  memory: { phase: string; rssBytes: number; heapUsedBytes: number }[] = [];
function sample(phase: string) {
  const m = process.memoryUsage();
  memory.push({ phase, rssBytes: m.rss, heapUsedBytes: m.heapUsed });
}
const phase = performance.now();
const full = scaleFixture(count).map((l) =>
    projectFreshness(l, 14, BENCHMARK_NOW, 6),
  ),
  compact = full.map(catalogListing),
  workspace = scaleWorkspace(full);
const generationMs = performance.now() - phase;
sample("generated-full-and-compact");
const fullBytes = jsonArrayBytes(full),
  compactBytes = jsonArrayBytes(compact);
const packingStart = performance.now();
const packed = packCatalog({ schemaVersion: 1, listings: compact });
const packingMs = performance.now() - packingStart,
  packedBytes = Buffer.byteLength(JSON.stringify(packed));
sample("packed-transport");
const decodeStart = performance.now(),
  decoded = unpackCatalog<{ schemaVersion: number; listings: Listing[] }>(
    packed,
  ).listings,
  unpackMs = performance.now() - decodeStart;
assert.equal(decoded.length, count);
sample("decoded-browser-catalog");
console.log(
  JSON.stringify({
    phase: "dataset-ready",
    ads: count,
    fullBytes,
    compactBytes,
    packedBytes,
  }),
);
const queries: Record<string, unknown>[] = [];
for (const { name, filters } of scaleQueries()) {
  gc();
  const start = performance.now(),
    expected = searchListings(full, filters, workspace, BENCHMARK_NOW),
    fullSearchMs = performance.now() - start;
  const compactStart = performance.now(),
    compactResult = searchListings(compact, filters, workspace, BENCHMARK_NOW),
    compactSearchMs = performance.now() - compactStart;
  const decodedStart = performance.now(),
    browser = searchListings(decoded, filters, workspace, BENCHMARK_NOW),
    decodedSearchMs = performance.now() - decodedStart;
  assert.equal(
    signature(compactResult.rows),
    signature(expected.rows),
    `${name}: compact predicate drift`,
  );
  assert.equal(
    signature(browser.rows),
    signature(expected.rows),
    `${name}: decoded browser predicate drift`,
  );
  assert.equal(browser.rawCount, expected.rawCount);
  assert.equal(browser.groupCount, expected.groupCount);
  const alertStart = performance.now(),
    matchingAds = searchListings(
      full,
      { ...filters, grouped: false },
      workspace,
      BENCHMARK_NOW,
    ).rows;
  assert.equal(
    digest(matchingAds.map((l) => l.id).sort()),
    digest(
      full
        .filter((l) => matches(l, filters, workspace, BENCHMARK_NOW))
        .map((l) => l.id)
        .sort(),
    ),
    `${name}: alert membership differs`,
  );
  const alertResult = evaluateAlertPolicy({
    allListings: full,
    matchingAds,
    previous: null,
    now: new Date(BENCHMARK_NOW),
  });
  assert.equal(
    alertResult.changes.length,
    0,
    "Initial alert baseline must be quiet",
  );
  assert.equal(
    digest(Object.keys(alertResult.baseline.ads).sort()),
    digest(matchingAds.map((l) => l.id).sort()),
  );
  const alertBaselineMs = performance.now() - alertStart;
  const offsets = [
    ...new Set([
      0,
      Math.floor(expected.rows.length / 2),
      Math.max(0, expected.rows.length - 48),
    ]),
  ];
  const pages: {
    offset: number;
    rows: number;
    scannedRows: number;
    databaseBatches: number;
    durationMs: number;
  }[] = [];
  for (const offset of offsets) {
    let scannedRows = 0,
      databaseBatches = 0;
    async function* batches() {
      for (let i = 0; i < full.length; i += 500) {
        const rows = full
          .slice(i, i + 500)
          .map((l) => ({ payload: JSON.stringify(l) }));
        scannedRows += rows.length;
        databaseBatches++;
        yield rows;
      }
    }
    const apiStart = performance.now(),
      page = await searchPageFromBatches(filters, offset, 48, {
        batches: batches(),
        workspace,
        staleDays: 14,
        auctionMaxAgeHours: 6,
        now: BENCHMARK_NOW,
      });
    assert.equal(
      signature(page.rows),
      signature(expected.rows.slice(offset, offset + 48)),
      `${name}: paginated API drift`,
    );
    assert.equal(page.total, expected.rows.length);
    assert.equal(page.rawCount, expected.rawCount);
    assert.equal(page.groupCount, expected.groupCount);
    pages.push({
      offset,
      rows: page.rows.length,
      scannedRows,
      databaseBatches,
      durationMs: rounded(performance.now() - apiStart),
    });
  }
  queries.push({
    name,
    matchedAds: expected.rawCount,
    displayedGroupsOrAds: expected.rows.length,
    groupCount: expected.groupCount,
    parity: "passed",
    fullSearchMs: rounded(fullSearchMs),
    compactSearchMs: rounded(compactSearchMs),
    decodedSearchMs: rounded(decodedSearchMs),
    alertBaselineMs: rounded(alertBaselineMs),
    resultIdsSha256: signature(expected.rows),
    pages,
  });
  sample(name);
  if (queries.length % 4 === 0)
    console.log(
      JSON.stringify({
        phase: "search-parity",
        completedQueries: queries.length,
        totalQueries: scaleQueries().length,
      }),
    );
}
gc();
const candidateStart = performance.now(),
  candidates = rankDuplicateCandidates(full, { limit: 100 }),
  candidateMs = performance.now() - candidateStart;
sample("candidate-index");
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  fixedEvaluationAt: new Date(BENCHMARK_NOW).toISOString(),
  syntheticAds: count,
  fixture:
    "Deterministic synthetic crossposts spanning classic and later specialty identities, source claims/clones, exact 240-minute routes, expired/future routes, unknown/offsite/non-US locations, auctions and stale observations. No real records or service calls are used.",
  environment: {
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    explicitGcBetweenQueries: Boolean((globalThis as { gc?: unknown }).gc),
  },
  durationMs: rounded(performance.now() - started),
  generationMs: rounded(generationMs),
  bytes: {
    fullListingJson: fullBytes,
    compactListingJson: compactBytes,
    packedCatalogJson: packedBytes,
    reductionFromFullPercent: rounded((1 - packedBytes / fullBytes) * 100),
    dictionaryStrings: packed.strings.length,
  },
  codec: {
    packMs: rounded(packingMs),
    unpackMs: rounded(unpackMs),
    losslessCompactRoundTrip: true,
  },
  candidateIndex: {
    ...candidates.diagnostics,
    totalCandidates: candidates.total,
    durationMs: rounded(candidateMs),
    allPairsUpperBound: (count * (count - 1)) / 2,
    comparedFractionOfAllPairs:
      candidates.diagnostics.comparedPairs / ((count * (count - 1)) / 2),
  },
  memory: {
    maxRssKiBReportedByNode: process.resourceUsage().maxRSS,
    maxSampledRssBytes: Math.max(...memory.map((m) => m.rssBytes)),
    phases: memory,
  },
  queries,
  validation: {
    allQueriesPassed: true,
    initialAlertBaselinesQuiet: true,
    realDatabaseStorageBenchmark: false,
    realBrowserRenderingBenchmark: false,
    liveNetworkRequests: 0,
  },
  limitations: [
    "API page core uses 500-row in-memory batches with real JSON parsing and shared predicates; this measures its algorithm, not SQLite disk latency or HTTP/browser rendering.",
    "Every requested API offset still scans all candidate rows and retains all matching listings for sorting/grouping. Bounded database reads do not establish bounded total memory.",
    "Candidate indexes exclude generic titles, but a heavily colliding distinctive-title/stock/identifier bucket can still produce quadratic work; this fixture is not a worst-case collision proof.",
    "No source coverage, vehicle authenticity, deduplication precision on real inventory, or hosting behavior is established by synthetic performance results.",
    "Elapsed times and resident memory depend on the host and concurrent workloads; use this report as a recorded baseline, not a universal service-level promise.",
  ],
};
if (output) {
  const target = path.resolve(output);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(report, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        report: target,
        syntheticAds: count,
        durationMs: report.durationMs,
        validation: report.validation,
        candidateIndex: report.candidateIndex,
        bytes: report.bytes,
      },
      null,
      2,
    ),
  );
} else console.log(JSON.stringify(report, null, 2));
