import {
  configuredCatalogUrls,
  paginationScopeIssue,
} from "./scope-validation";
import { readFile } from "node:fs/promises";
import { db } from "../db";
import {
  acquireLease,
  getSettings,
  allListings,
  upsertListing,
  exportSnapshot,
} from "../store";
import { cachedPage } from "../safe-fetch";
import { reserveServiceRequest } from "../service-budget";
import {
  parseInventory,
  parseDetail,
  detailUrl,
  type SourceConfig,
} from "./adapters";
import { operations } from "./state";
import { classifyFailure, FetchFailure } from "./failures";
import type { CatalogCheckpoint, CollectionJob, Scope } from "./operations";
import type { Listing } from "../../shared/schema";
export type CollectionCaps = {
  pageCap?: number;
  detailCap?: number;
  shouldStop?: () => boolean;
  jobId?: string;
  smoke?: boolean;
  fresh?: boolean;
};
export async function collect(
  scope: Scope = "regional",
  only?: string,
  caps: CollectionCaps = {},
) {
  let job: CollectionJob | null = caps.jobId
    ? await operations.job(caps.jobId)
    : await operations.enqueue({
        scope,
        sourceId: only,
        pageCap: caps.pageCap,
        detailCap: caps.detailCap,
        smoke: caps.smoke,
        fresh: caps.fresh,
      });
  if (!job) throw new Error("Unknown collection job.");
  if (job.status !== "running") job = await operations.claim(job.id);
  if (!job)
    return {
      status: "not-ready",
      reason: "Job is cancelled, already running, or not yet due.",
    };
  const jobId = job.id;
  const lease = await acquireLease("musclescout-collection");
  if (!lease) {
    await operations.finish(
      jobId,
      { status: "busy" },
      "interrupted",
      new Date(Date.now() + 30000).toISOString(),
    );
    return {
      status: "busy",
      jobId,
      reason:
        "Another collection holds a renewable database lease; this job remains queued.",
    };
  }
  let leaseLost = false;
  const timer = setInterval(
    () =>
      Promise.all([lease.renew(), operations.heartbeat(jobId)]).catch(() => {
        leaseLost = true;
      }),
    30000,
  );
  const stopping = async () => {
    if (leaseLost)
      throw new Error("Collection lease lost; persisted work remains pending.");
    return Boolean(
      caps.shouldStop?.() ||
      (await operations.job(jobId))?.cancellationRequested,
    );
  };
  const summaries: Record<string, unknown>[] = [];
  let interrupted = false;
  try {
    await db.ingestRun.updateMany({
      where: { status: "running" },
      data: {
        status: "interrupted",
        finishedAt: new Date(),
        error: "Prior process interrupted; collection lease recovered.",
      },
    });
    const settings = await getSettings();
    const pageCap = caps.smoke ? 1 : (caps.pageCap ?? settings.maxPages);
    const detailCap = caps.smoke ? 1 : (caps.detailCap ?? settings.maxDetails);
    const sources: SourceConfig[] = JSON.parse(
      await readFile("config/sources.json", "utf8"),
    );
    const selected = sources.filter(
      (s) =>
        s.enabled &&
        (!only || only === s.id) &&
        (settings.enabledSources.length === 0 ||
          settings.enabledSources.includes(s.id)),
    );
    if (!selected.length)
      throw new Error(
        "No enabled source matches the requested collection scope.",
      );
    for (const source of selected) {
      if (await stopping()) {
        interrupted = true;
        break;
      }
      await lease.renew();
      // Existing denied observations establish a review pause on upgrade, not another automatic probe.
      if (!(await operations.read("health:" + source.id))) {
        const prior = await db.ingestRun.findFirst({
          where: { sourceId: source.id },
          orderBy: { startedAt: "desc" },
        });
        const text = prior?.error || "";
        if (
          prior &&
          /403|401|challenge|policy|robots|unavailable template|page unavailable/i.test(
            text,
          )
        )
          await operations.failure(source.id, classifyLegacy(text), source.url);
      }
      const urls = configuredCatalogUrls(source, scope, settings);
      let checkpoint = await operations.checkpoint(
        source.id,
        scope,
        urls,
        caps.smoke || (caps.fresh && pageCap > 0 && job.attempts <= 1)
          ? 0
          : settings.cacheHours * 36e5,
      );
      const existing = new Map(
        (await allListings())
          .filter((l) => l.sourceId === source.id)
          .map((l) => [l.id, l]),
      );
      // Bootstrap previous observations once without pretending they were rediscovered in this query.
      const bootstrap = [...existing.values()].filter((l) => l.scope === scope);
      await operations.discoverDetails(
        source.id,
        scope,
        "legacy-observation",
        bootstrap,
      );
      const run = await db.ingestRun.create({
        data: { sourceId: source.id, scope, status: "running" },
      });
      const ids = new Set<string>();
      const stats = {
        jobId,
        checkpointId: checkpoint.id,
        catalogCycle: checkpoint.cycle,
        pagesDiscovered: checkpoint.tasks.length,
        configuredUrls: urls,
        discoveryMiles: settings.discoveryMiles,
        pagesFetched: 0,
        detailRequests: 0,
        detailsSucceeded: 0,
        freshDetailsSkipped: 0,
        failedInventoryPages: 0,
        failedDetails: 0,
        cacheHits: 0,
        discoveredCandidates: 0,
        uniqueAds: 0,
        duplicateIds: 0,
        skippedCandidates: 0,
        remainingEnrichment: 0,
        catalogBacklog: 0,
        blockedCatalogBacklog: 0,
        totalCatalogPages: checkpoint.tasks.length,
        totalDetailBacklog: 0,
        blockedDetailBacklog: 0,
        currentScopeDetailBacklog: 0,
        currentScopeBlockedDetails: 0,
        failedPages: [] as string[],
        pageCap,
        detailCap,
        note: "",
        accessHealth: await operations.health(source.id),
      };
      let paused = !(await operations.allowed(source.id, caps.smoke));
      let liveCatalog = false,
        liveDetail = false;
      const pageOptions = (hours: number) => ({
        origins: source.origins || [new URL(source.url).origin],
        cacheHours: caps.smoke || caps.fresh ? 0 : hours,
        delayMs: source.delayMs || 10000,
        beforeRequest: async (url: string, delayMs: number) => {
          if (await stopping())
            throw new FetchFailure(
              "Collection cancellation or shutdown requested.",
              "cancelled",
            );
          await reserveServiceRequest(new URL(url).origin, {
            minIntervalMs: delayMs,
            dailyLimit:
              (source as SourceConfig & { dailyRequestLimit?: number })
                .dailyRequestLimit || 1000,
          });
        },
      });
      try {
        // The FIFO survives the process and is shared across all configured query starts.
        while (!paused && stats.pagesFetched < pageCap) {
          if (await stopping()) {
            interrupted = true;
            break;
          }
          const task = (await operations.catalogTasks(checkpoint.id))[0];
          if (!task) break;
          try {
            const page = await cachedPage(
              task.url,
              pageOptions(settings.cacheHours),
            );
            stats.pagesFetched++;
            if (page.cacheHit) stats.cacheHits++;
            const parsed = parseInventory(page.html, source, {
              ...page,
              scope,
            });
            for (const next of parsed.next) {
              const issue = paginationScopeIssue(source, scope, task.url, next);
              if (issue) throw new FetchFailure(issue, "layout");
            }
            stats.discoveredCandidates += parsed.discovered;
            for (const listing of parsed.listings) {
              if (ids.has(listing.id)) stats.duplicateIds++;
              ids.add(listing.id);
              const saved = await upsertListing(listing);
              existing.set(saved.id, saved);
            }
            // Save ads and their independent detail queue before acknowledging this page.
            await operations.discoverDetails(
              source.id,
              scope,
              task.queryId,
              parsed.listings.map((l) => existing.get(l.id) || l),
            );
            checkpoint = await operations.completePage(
              checkpoint.id,
              task,
              parsed.next,
              {
                observedAt: page.observedAt,
                evidenceHash: page.hash,
                cacheHit: page.cacheHit,
                parserVersion: `${source.id}-v1`,
              },
            );
            liveCatalog ||= !page.cacheHit;
            await operations.success(source.id, !page.cacheHit);
          } catch (error) {
            if (classifyFailure(error).kind === "cancelled") {
              interrupted = true;
              break;
            }
            stats.failedInventoryPages++;
            stats.failedPages.push(`${task.url}: ${(error as Error).message}`);
            const health = await operations.failure(source.id, error, task.url);
            await operations.failPage(checkpoint.id, task, error, health);
            paused = true;
          }
        }
        const maxAge = (id: string) =>
          caps.smoke
            ? 0
            : (existing.get(id)?.saleType === "auction"
                ? Math.min(settings.cacheHours, 1)
                : settings.cacheHours) * 36e5;
        const candidates = await operations.detailTasks(
          source.id,
          scope,
          maxAge,
        );
        for (const task of candidates) {
          if (paused || interrupted || stats.detailRequests >= detailCap) break;
          if (await stopping()) {
            interrupted = true;
            break;
          }
          const listing = existing.get(task.listingId);
          if (!listing) {
            await operations.failDetail(
              source.id,
              task.listingId,
              new FetchFailure(
                "Source ad no longer exists locally; review queue entry.",
                "missing",
              ),
              await operations.health(source.id),
            );
            continue;
          }
          if (source.id === "500classic") {
            await operations.failDetail(
              source.id,
              listing.id,
              new FetchFailure(
                "Detail access remains paused after the observed HTTP 403; an authorized ordinary access path is required.",
                "access",
                403,
              ),
              { ...(await operations.health(source.id)), state: "review" },
            );
            continue;
          }
          try {
            stats.detailRequests++;
            listing.lastDetailAttemptAt = new Date().toISOString();
            await upsertListing(listing);
            const page = await cachedPage(
              detailUrl(listing),
              pageOptions(maxAge(listing.id) / 36e5),
            );
            if (page.cacheHit) stats.cacheHits++;
            const enriched = parseDetail(page.html, listing, {
              ...page,
              scope,
            });
            await upsertListing(enriched);
            await operations.completeDetail(
              source.id,
              listing.id,
              page.observedAt,
            );
            stats.detailsSucceeded++;
            liveDetail ||= !page.cacheHit;
            await operations.success(source.id, !page.cacheHit);
          } catch (error) {
            if (classifyFailure(error).kind === "cancelled") {
              interrupted = true;
              break;
            }
            stats.failedDetails++;
            stats.failedPages.push(
              `${listing.url}: ${(error as Error).message}`,
            );
            const health = await operations.failure(
              source.id,
              error,
              listing.url,
            );
            await operations.failDetail(source.id, listing.id, error, health);
            if (health.state !== "active") paused = true;
          }
        }
        if (
          caps.smoke &&
          liveCatalog &&
          liveDetail &&
          !stats.failedPages.length
        )
          await operations.success(source.id, true, true);
        checkpoint = (await operations.read<CatalogCheckpoint>(
          "catalog:" + checkpoint.id,
        ))!;
        const details = Object.values(
          (await operations.details(source.id)).items,
        );
        const due = await operations.detailTasks(source.id, scope, maxAge);
        stats.uniqueAds = ids.size;
        stats.skippedCandidates = Math.max(
          0,
          stats.discoveredCandidates - ids.size,
        );
        stats.pagesDiscovered = stats.totalCatalogPages =
          checkpoint.tasks.length;
        stats.catalogBacklog = checkpoint.tasks.filter(
          (t) => t.status === "pending",
        ).length;
        stats.blockedCatalogBacklog = checkpoint.tasks.filter(
          (t) => t.status === "blocked",
        ).length;
        stats.blockedDetailBacklog = details.filter(
          (t) => t.status === "blocked",
        ).length;
        stats.totalDetailBacklog = details.filter(
          (t) =>
            t.status !== "complete" ||
            !t.completedAt ||
            Date.now() - Date.parse(t.completedAt) >= maxAge(t.listingId),
        ).length;
        stats.currentScopeBlockedDetails = details.filter(
          (t) => t.scopes.includes(scope) && t.status === "blocked",
        ).length;
        stats.currentScopeDetailBacklog = details.filter(
          (t) => t.scopes.includes(scope) && t.status !== "complete",
        ).length;
        stats.remainingEnrichment =
          due.length +
          details.filter(
            (t) => t.scopes.includes(scope) && t.status === "blocked",
          ).length;
        stats.freshDetailsSkipped =
          details.filter(
            (t) => t.scopes.includes(scope) && t.status === "complete",
          ).length - due.filter((t) => t.status === "complete").length;
        stats.accessHealth = await operations.health(source.id);
        const status = interrupted
          ? "interrupted"
          : paused ||
              stats.accessHealth.state === "review" ||
              stats.accessHealth.state === "smoke-required"
            ? "blocked"
            : stats.catalogBacklog ||
                stats.blockedCatalogBacklog ||
                stats.remainingEnrichment ||
                stats.failedPages.length ||
                source.id === "500classic" ||
                (source.id === "autotrader" && scope === "nationwide")
              ? "partial"
              : "complete";
        stats.note = interrupted
          ? "Stopped at a request boundary; checkpoints and pending detail work are retained."
          : status === "blocked"
            ? "Source access is paused or cooling down; see classified health and next permitted check."
            : stats.catalogBacklog
              ? "Catalog cap reached; the next run resumes queued pages."
              : stats.remainingEnrichment
                ? "Catalog checkpoint retained; independent detail enrichment remains."
                : "Configured scope exhausted; this does not establish full nationwide coverage.";
        await db.ingestRun.update({
          where: { id: run.id },
          data: {
            status,
            finishedAt: new Date(),
            stats: JSON.stringify(stats),
            error:
              stats.failedPages[0] ||
              (status === "blocked"
                ? stats.accessHealth.lastFailure?.message
                : null) ||
              null,
          },
        });
        summaries.push({ source: source.id, status, ...stats });
      } catch (error) {
        await db.ingestRun.update({
          where: { id: run.id },
          data: {
            status: "failed",
            finishedAt: new Date(),
            error: (error as Error).message,
            stats: JSON.stringify(stats),
          },
        });
        summaries.push({
          source: source.id,
          status: "failed",
          error: (error as Error).message,
        });
      }
    }
    await exportSnapshot();
    const pending = summaries.some((s) => s.status !== "complete");
    const resumable = summaries.some(
      (s) =>
        s.status === "partial" &&
        ((pageCap > 0 && (s.catalogBacklog as number) > 0) ||
          (detailCap > 0 &&
            (s.remainingEnrichment as number) >
              (s.currentScopeBlockedDetails as number))),
    );
    const nextChecks = summaries.flatMap((s) => {
      const h = s.accessHealth as
        { state?: string; nextPermittedAt?: string | null } | undefined;
      return h?.state === "cooldown" && h.nextPermittedAt
        ? [Date.parse(h.nextPermittedAt)]
        : [];
    });
    const nextRunAt = caps.smoke
      ? null
      : interrupted
        ? new Date(Date.now() + 10000).toISOString()
        : resumable
          ? new Date(Date.now() + 60000).toISOString()
          : nextChecks.length
            ? new Date(Math.min(...nextChecks)).toISOString()
            : null;
    const result = {
      status: interrupted ? "interrupted" : pending ? "partial" : "finished",
      jobId,
      scope,
      sources: summaries,
    };
    await operations.finish(
      jobId,
      result,
      interrupted ? "interrupted" : pending ? "partial" : "completed",
      nextRunAt,
    );
    return result;
  } catch (error) {
    await operations.failJob(jobId, error);
    throw error;
  } finally {
    clearInterval(timer);
    await lease.release();
  }
}
function classifyLegacy(message: string) {
  const f = classifyFailure(new Error(message));
  return new FetchFailure(message, f.kind, f.httpStatus, f.retryAfterAt);
}
