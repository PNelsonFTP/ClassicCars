import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildScopeValidationReport,
  configuredCatalogUrls,
  inspectScopeConfiguration,
  paginationScopeIssue,
  type ScopeSource,
} from "../server/ingest/scope-validation";
import { parseInventory } from "../server/ingest/adapters";
import { settingsSchema } from "../shared/schema";
import type { CatalogCheckpoint } from "../server/ingest/operations";
const sources = JSON.parse(
  readFileSync("config/sources.json", "utf8"),
) as ScopeSource[];
const source = (id: string) => sources.find((s) => s.id === id)!;
const now = "2026-09-08T12:00:00.000Z";
describe("scope configuration and honest coverage", () => {
  it("keeps national ClassicCars discovery independent of home and removes its regional radius", () => {
    const urls = configuredCatalogUrls(
      source("classiccars"),
      "nationwide",
      settingsSchema.parse({
        home: {
          city: "New York",
          state: "NY",
          country: "US",
          postalCode: "10001",
          precision: "city",
        },
      }),
    );
    expect(urls).toHaveLength(3);
    expect(
      urls.every(
        (u) =>
          !new URL(u).searchParams.has("zip") &&
          !new URL(u).searchParams.has("distance"),
      ),
    ).toBe(true);
    expect(
      inspectScopeConfiguration(source("classiccars"), "nationwide").issues,
    ).toEqual([]);
  });
  it("fingerprints the configured regional discovery envelope with the actual home", () => {
    const settings = settingsSchema.parse({
      home: {
        city: "New York",
        state: "NY",
        country: "US",
        postalCode: "10001",
        precision: "city",
      },
      discoveryMiles: 200,
    });
    const u = new URL(
      configuredCatalogUrls(source("classiccars"), "regional", settings)[0],
    );
    expect(u.searchParams.get("zip")).toBe("10001");
    expect(u.searchParams.get("distance")).toBe("250");
    settings.discoveryMiles = 800;
    expect(
      new URL(
        configuredCatalogUrls(source("classiccars"), "regional", settings)[0],
      ).searchParams.has("distance"),
    ).toBe(false);
  });
  it("flags regional parameters accidentally retained in a national profile", () => {
    const broken = {
      ...source("classiccars"),
      nationwideInventory: source("classiccars").inventory,
    };
    expect(
      inspectScopeConfiguration(broken, "nationwide").issues.join(" "),
    ).toContain("retains regional");
  });
  it("identifies broad dealer catalogs and incidental specialty discovery without national claims", () => {
    expect(
      inspectScopeConfiguration(source("volo"), "nationwide"),
    ).toMatchObject({
      sameCatalogForBothScopes: true,
      specialtyDiscovery: { kind: "incidental-broad-inventory" },
    });
    expect(
      inspectScopeConfiguration(source("classiccars"), "nationwide")
        .specialtyDiscovery.kind,
    ).toBe("classic-only-queries");
    expect(
      inspectScopeConfiguration(source("autotrader"), "nationwide").issues,
    ).toEqual([]);
  });
  it("rejects the retained regional fixture's next page when used as a national page", () => {
    const s = source("classiccars"),
      url = configuredCatalogUrls(s, "nationwide")[0];
    const html = readFileSync(
      "tests/fixtures/classiccars-catalog.html",
      "utf8",
    );
    const parsed = parseInventory(html, s, {
      url,
      observedAt: now,
      lastNetworkCheckedAt: now,
      hash: "fixture",
      scope: "nationwide",
    });
    expect(parsed.next.length).toBeGreaterThan(0);
    expect(
      paginationScopeIssue(s, "nationwide", url, parsed.next[0]),
    ).toContain("changed configured");
    expect(parsed.listings.every((l) => l.scope === "nationwide")).toBe(true); // Context labeling alone cannot validate remote scope.
  });
  it("accepts a next page preserving semantic filters and rejects changed model/year bounds", () => {
    const s = source("autotrader"),
      u = new URL(configuredCatalogUrls(s, "nationwide")[0]);
    const next = new URL(u);
    next.searchParams.set("firstRecord", "25");
    expect(paginationScopeIssue(s, "nationwide", u.href, next.href)).toBeNull();
    next.searchParams.set("startYear", "2020");
    expect(paginationScopeIssue(s, "nationwide", u.href, next.href)).toContain(
      "startYear",
    );
  });
  it("does not turn historical complete runs without checkpoints into national completeness", () => {
    const report = buildScopeValidationReport({
      sources: [source("volo")],
      listings: [],
      catalogs: [],
      runs: [
        {
          sourceId: "volo",
          scope: "nationwide",
          status: "complete",
          startedAt: now,
        },
      ],
      generatedAt: now,
    });
    const national = report.sources[0].scopes[1];
    expect(national.configuredCatalogStatus).toBe(
      "not-run-with-durable-checkpoints",
    );
    expect(national.nationwideCompleteness).toBe("not established");
    expect(national.terminalPageEvidence).toEqual([]);
  });
  it("keeps original observation freshness separate from recently processed cached terminal evidence", () => {
    const s = source("volo"),
      urls = configuredCatalogUrls(s, "nationwide");
    const cp: CatalogCheckpoint = {
      id: "fixture",
      sourceId: "volo",
      scope: "nationwide",
      configuredUrls: urls,
      cycle: 1,
      startedAt: now,
      completedAt: now,
      tasks: [
        {
          queryId: "q",
          url: urls[0],
          status: "complete",
          attempts: 1,
          nextAttemptAt: null,
          completedAt: now,
          terminal: true,
          observedAt: "2026-08-01T12:00:00Z",
          evidenceHash: "retained-html-hash",
          cacheHit: true,
        } as CatalogCheckpoint["tasks"][number],
      ],
    };
    const report = buildScopeValidationReport({
      sources: [s],
      listings: [
        {
          sourceId: "volo",
          scope: "nationwide",
          lastObservedAt: "2026-08-01T12:00:00Z",
          year: 1969,
          model: "Camaro",
          specialty: null,
          specialtyEvidence: "unknown",
        },
      ],
      catalogs: [cp],
      runs: [],
      generatedAt: now,
    });
    const national = report.sources[0].scopes[1];
    expect(national.configuredCatalogStatus).toBe(
      "configured-checkpoint-exhausted",
    );
    expect(national.freshness.freshObservedAds).toBe(0);
    expect(national.terminalPageEvidence[0].observedAt).toBe(
      "2026-08-01T12:00:00Z",
    );
    expect(national.nationwideCompleteness).toBe("not established");
  });
});
