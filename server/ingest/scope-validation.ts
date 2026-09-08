import {
  canonicalPage,
  type CatalogCheckpoint,
  type Scope,
} from "./operations";
import type { SourceConfig } from "./adapters";
import type { Listing, Settings } from "../../shared/schema";
export type ScopeSource = SourceConfig & { specialtyInventory?: string[] };
const normalizeUrl = (raw: string) => {
  try {
    return canonicalPage(raw);
  } catch {
    return raw;
  }
};
export type PageEvidence = {
  terminal?: boolean;
  observedAt?: string;
  evidenceHash?: string;
  cacheHit?: boolean;
  parserVersion?: string;
};
export function configuredCatalogUrls(
  source: ScopeSource,
  scope: Scope,
  settings?: Pick<Settings, "home" | "discoveryMiles">,
) {
  let urls = [
    ...(scope === "nationwide"
      ? source.nationwideInventory || source.inventory || []
      : source.inventory || []),
  ];
  if (source.id === "classiccars" && scope === "regional" && settings)
    urls = urls.map((raw) => {
      const u = new URL(raw),
        zip =
          settings.home.postalCode ||
          (settings.home.city.toLowerCase() === "wheaton" &&
          settings.home.state === "IL"
            ? "60187"
            : null);
      if (zip && settings.discoveryMiles <= 500) {
        u.searchParams.set("zip", zip);
        u.searchParams.set(
          "distance",
          String(settings.discoveryMiles <= 250 ? 250 : 500),
        );
      } else {
        u.searchParams.delete("zip");
        u.searchParams.delete("distance");
      }
      return u.href;
    });
  return [...new Set(urls.map(normalizeUrl))];
}
export function inspectScopeConfiguration(
  source: ScopeSource,
  scope: Scope,
  settings?: Pick<Settings, "home" | "discoveryMiles">,
) {
  const urls = configuredCatalogUrls(source, scope, settings),
    issues: string[] = [];
  const parsed = urls.flatMap((raw) => {
    try {
      return [new URL(raw)];
    } catch {
      issues.push("Configured URL is malformed.");
      return [];
    }
  });
  for (const u of parsed) {
    if (u.protocol !== "https:" || u.username || u.password)
      issues.push("Catalog URLs must be credential-free HTTPS.");
    if (source.origins && !source.origins.includes(u.origin))
      issues.push("Configured catalog origin is outside the source allowlist.");
  }
  const models = ["mustang", "camaro", "corvette"];
  if (source.id === "classiccars" && urls.length) {
    for (const model of models)
      if (!parsed.some((u) => u.pathname.endsWith("/" + model)))
        issues.push(`No configured classic ${model} query.`);
    if (parsed.some((u) => !u.pathname.includes("/1960-1989/")))
      issues.push(
        "A ClassicCars classic query does not express the intended 1960–1989 bounds.",
      );
    if (
      scope === "nationwide" &&
      parsed.some(
        (u) => u.searchParams.has("zip") || u.searchParams.has("distance"),
      )
    )
      issues.push(
        "A nationwide ClassicCars URL retains regional zip/distance parameters.",
      );
    if (parsed.some((u) => u.searchParams.get("country") !== "united-states"))
      issues.push("A ClassicCars query has no explicit US country parameter.");
  }
  if (source.id === "autotrader" && urls.length) {
    if (
      parsed.some(
        (u) =>
          u.searchParams.get("startYear") !== "1960" ||
          u.searchParams.get("endYear") !== "1989",
      )
    )
      issues.push(
        "An Autotrader classic query does not express the intended year bounds.",
      );
    if (scope === "nationwide") {
      for (const model of models)
        if (!parsed.some((u) => u.pathname.endsWith("/" + model)))
          issues.push(`No configured nationwide ${model} query.`);
      if (
        parsed.some(
          (u) =>
            u.searchParams.get("searchRadius") !== "0" ||
            u.searchParams.has("zip"),
        )
      )
        issues.push(
          "A nationwide Autotrader URL retains a geographic limit or lacks the configured radius=0 parameter.",
        );
    }
  }
  const regional = (source.inventory || []).map(normalizeUrl).sort();
  const national = (source.nationwideInventory || source.inventory || [])
    .map(normalizeUrl)
    .sort();
  return {
    urls,
    configuration: !urls.length
      ? "unconfigured"
      : issues.length
        ? "review-needed"
        : "configuration-consistent",
    issues,
    sameCatalogForBothScopes:
      regional.length > 0 &&
      JSON.stringify(regional) === JSON.stringify(national),
    remoteFilterAcceptance:
      "not established by URL inspection or offline fixtures",
    specialtyDiscovery: source.specialtyInventory?.length
      ? { kind: "explicit-configured", urls: source.specialtyInventory }
      : {
          kind:
            source.id === "classiccars" || source.id === "autotrader"
              ? "classic-only-queries"
              : urls.length
                ? "incidental-broad-inventory"
                : "unconfigured",
          urls: [],
        },
  };
}
/** Reject remote pagination that silently narrows a national query or drops its classic bounds. */
export function paginationScopeIssue(
  source: ScopeSource,
  scope: Scope,
  currentRaw: string,
  nextRaw: string,
): string | null {
  let current: URL, next: URL;
  try {
    current = new URL(currentRaw);
    next = new URL(nextRaw);
  } catch {
    return "Pagination URL is malformed.";
  }
  if (next.origin !== current.origin)
    return "Pagination changed the source origin.";
  if (
    ["classiccars", "autotrader"].includes(source.id) &&
    next.pathname !== current.pathname
  )
    return "Pagination changed the configured model/year query path.";
  const keys =
    source.id === "classiccars"
      ? ["country", "zip", "distance"]
      : source.id === "autotrader"
        ? ["startYear", "endYear", "searchRadius", "zip"]
        : [];
  for (const key of keys)
    if (next.searchParams.get(key) !== current.searchParams.get(key))
      return `Pagination changed configured ${key}; ${scope} coverage cannot be established.`;
  return null;
}
export type ScopeValidationInput = {
  sources: ScopeSource[];
  listings: Pick<
    Listing,
    | "sourceId"
    | "scope"
    | "lastObservedAt"
    | "year"
    | "model"
    | "specialtyEvidence"
    | "specialty"
  >[];
  catalogs: CatalogCheckpoint[];
  runs: {
    sourceId: string;
    scope: string;
    status: string;
    startedAt: string | Date;
    finishedAt?: string | Date | null;
    error?: string | null;
  }[];
  settings?: Pick<Settings, "home" | "discoveryMiles" | "staleDays">;
  generatedAt?: string;
};
const date = (v: string | Date | null | undefined) =>
  v ? new Date(v).toISOString() : null;
export function buildScopeValidationReport(input: ScopeValidationInput) {
  const generatedAt = input.generatedAt || new Date().toISOString(),
    now = Date.parse(generatedAt),
    maxAgeMs = (input.settings?.staleDays || 7) * 864e5;
  const sources = input.sources.map((source) => ({
    sourceId: source.id,
    name: source.name,
    enabled: Boolean(source.enabled),
    policyStatus: source.status,
    documentedScope: source.scope,
    scopes: (["regional", "nationwide"] as Scope[]).map((scope) => {
      const config = inspectScopeConfiguration(source, scope, input.settings),
        listings = input.listings.filter(
          (l) => l.sourceId === source.id && l.scope === scope,
        );
      const matching = input.catalogs
        .filter(
          (c) =>
            c.sourceId === source.id &&
            c.scope === scope &&
            JSON.stringify(c.configuredUrls.map(normalizeUrl).sort()) ===
              JSON.stringify([...config.urls].sort()),
        )
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      const cp = matching[0],
        tasks = cp?.tasks || [],
        evidence = tasks as ((typeof tasks)[number] & PageEvidence)[];
      const complete = Boolean(
        cp?.completedAt &&
        tasks.length > 0 &&
        tasks.every((t) => t.status === "complete"),
      );
      const terminal = evidence
        .filter((t) => t.terminal === true)
        .map((t) => ({
          queryId: t.queryId,
          url: t.url,
          observedAt: t.observedAt || null,
          evidenceHash: t.evidenceHash || null,
          parserVersion: t.parserVersion || null,
          cacheHit: t.cacheHit ?? null,
          provenance:
            t.observedAt && t.evidenceHash
              ? "retained-observation"
              : "checkpoint-only",
        }));
      const latestRun = input.runs
        .filter((r) => r.sourceId === source.id && r.scope === scope)
        .sort(
          (a, b) =>
            Date.parse(date(b.startedAt)!) - Date.parse(date(a.startedAt)!),
        )[0];
      const observed = listings
        .map((l) => Date.parse(l.lastObservedAt))
        .filter(Number.isFinite);
      const supportedSpecialties = listings.filter(
        (l) =>
          l.model === "Mustang" &&
          l.year != null &&
          l.year > 1989 &&
          l.specialty &&
          ["document-supported", "user-reviewed"].includes(l.specialtyEvidence),
      );
      const freshness = {
        adsObservedInThisScope: listings.length,
        freshObservedAds: observed.filter(
          (at) => now - at >= 0 && now - at <= maxAgeMs,
        ).length,
        staleObservedAds: observed.filter((at) => now - at > maxAgeMs).length,
        futureOrInvalidObservedAds:
          listings.length - observed.filter((at) => at <= now).length,
        newestObservationAt: observed.length
          ? new Date(Math.max(...observed)).toISOString()
          : null,
        staleDays: maxAgeMs / 864e5,
      };
      return {
        scope,
        ...config,
        checkpointId: cp?.id || null,
        checkpointCycle: cp?.cycle || null,
        configuredCatalogStatus: !source.enabled
          ? "disabled"
          : !config.urls.length
            ? "unconfigured"
            : !cp
              ? "not-run-with-durable-checkpoints"
              : complete
                ? "configured-checkpoint-exhausted"
                : "partial",
        counts: {
          catalogPages: tasks.length,
          completed: tasks.filter((t) => t.status === "complete").length,
          pending: tasks.filter((t) => t.status === "pending").length,
          blocked: tasks.filter((t) => t.status === "blocked").length,
        },
        terminalPageEvidence: terminal,
        terminalEvidenceLimit: terminal.length
          ? "Recorded parser output establishes only the configured page chain; remote filters and broader coverage need source-specific verification."
          : complete
            ? "Checkpoint exhausted, but no explicit terminal-page provenance was retained by the older collector."
            : "No retained terminal-page observation establishes completion for this configuration.",
        freshness,
        supportedLaterSpecialtyAds: supportedSpecialties.length,
        latestRun: latestRun
          ? {
              status: latestRun.status,
              startedAt: date(latestRun.startedAt),
              finishedAt: date(latestRun.finishedAt),
              error: latestRun.error || null,
            }
          : null,
        nationwideCompleteness: "not established",
      };
    }),
  }));
  return {
    schemaVersion: 1,
    generatedAt,
    basis:
      "Local configuration, retained observations, durable checkpoints and historical run records. This report makes no network requests.",
    nationwideCompleteness: "not established",
    sources,
  };
}
export function scopeReportMarkdown(
  report: ReturnType<typeof buildScopeValidationReport>,
) {
  const lines = [
    "# Configured source scope validation",
    "",
    `Generated ${report.generatedAt}. ${report.basis}`,
    "",
    "No row establishes complete nationwide inventory. A terminal configured query, broad dealer catalog, fresh timestamp or matching URL parameter cannot establish that claim.",
    "",
    "| Source | Scope | Configuration | Catalog checkpoint | Observed ads / fresh | Explicit terminal observations |",
    "|---|---|---|---|---:|---:|",
  ];
  for (const source of report.sources)
    for (const scope of source.scopes)
      lines.push(
        `| ${source.name.replace(/\|/g, "\\|")} | ${scope.scope} | ${scope.configuration} | ${scope.configuredCatalogStatus} | ${scope.freshness.adsObservedInThisScope} / ${scope.freshness.freshObservedAds} | ${scope.terminalPageEvidence.length} |`,
      );
  lines.push(
    "",
    "## Remaining validation",
    "",
    "- Confirm actual remote filters and first/terminal pages through authorized bounded collection; offline fixtures validate parser behavior only.",
    "- Review separately fingerprinted regional/national query configurations. A changed home or discovery envelope has its own checkpoint.",
    "- Dealer inventory shared by both scopes does not become nationally complete.",
    "- Explicit later-specialty discovery remains unconfigured where reported. Broad inventory may contain incidental seller claims, which do not establish supported specialty status.",
    "- Inspect the companion JSON for original URLs, classified failures, freshness, terminal evidence hashes and checkpoint gaps.",
    "",
  );
  return lines.join("\n");
}
