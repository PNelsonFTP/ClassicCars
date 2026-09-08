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
import {
  parseInventory,
  parseDetail,
  detailUrl,
  type SourceConfig,
} from "./adapters";
import type { Listing } from "../../shared/schema";
export async function collect(
  scope: "regional" | "nationwide" = "regional",
  only?: string,
  caps?: { pageCap?: number; detailCap?: number; shouldStop?: () => boolean },
) {
  const lease = await acquireLease("musclescout-collection");
  if (!lease)
    return {
      status: "busy",
      reason: "Another collection holds a renewable database lease.",
    };
  const timer = setInterval(() => lease.renew().catch(() => {}), 30000);
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
    if (caps?.pageCap) settings.maxPages = caps.pageCap;
    if (caps?.detailCap) settings.maxDetails = caps.detailCap;
    const sources: SourceConfig[] = JSON.parse(
        await readFile("config/sources.json", "utf8"),
      ),
      summaries = [];
    for (const source of sources.filter(
      (s) =>
        s.enabled &&
        (!only || only === s.id) &&
        (settings.enabledSources.length === 0 ||
          settings.enabledSources.includes(s.id)),
    )) {
      if (caps?.shouldStop?.()) break;
      await lease.renew();
      const run = await db.ingestRun.create({
          data: { sourceId: source.id, scope, status: "running" },
        }),
        queue = [
          ...(scope === "nationwide"
            ? source.nationwideInventory || source.inventory || []
            : source.inventory || []),
        ],
        visited = new Set<string>(),
        ids = new Map<string, Listing>();
      for (let i = 0; i < queue.length; i++) {
        if (source.id === "classiccars" && scope === "regional") {
          const u = new URL(queue[i]);
          const zip =
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
          queue[i] = u.href;
        }
      }
      const stats = {
        pagesDiscovered: queue.length,
        configuredUrls: [...queue],
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
        failedPages: [] as string[],
        pageCap: settings.maxPages,
        detailCap: settings.maxDetails,
        note: "",
      };
      let stopped = false;
      try {
        while (queue.length && stats.pagesFetched < settings.maxPages) {
          if (caps?.shouldStop?.()) {
            stopped = true;
            break;
          }
          await lease.renew();
          const url = queue.shift()!;
          const canonical = new URL(url);
          if (
            canonical.searchParams.get("page") === "1" ||
            canonical.searchParams.get("p") === "1"
          ) {
            canonical.searchParams.delete("page");
            canonical.searchParams.delete("p");
          }
          const key = canonical.href;
          if (visited.has(key)) continue;
          visited.add(key);
          try {
            const page = await cachedPage(url, {
              origins: source.origins || [new URL(source.url).origin],
              cacheHours: settings.cacheHours,
              delayMs: source.delayMs || 10000,
            });
            stats.pagesFetched++;
            if (page.cacheHit) stats.cacheHits++;
            const parsed = parseInventory(page.html, source, {
              ...page,
              scope,
            });
            stats.discoveredCandidates += parsed.discovered;
            for (const listing of parsed.listings) {
              if (ids.has(listing.id)) {
                stats.duplicateIds++;
                continue;
              }
              ids.set(listing.id, listing);
            }
            for (const next of parsed.next) {
              if (!visited.has(next) && !queue.includes(next)) {
                queue.push(next);
                stats.pagesDiscovered++;
              }
            }
          } catch (e) {
            stats.failedPages.push(`${url}: ${(e as Error).message}`);
            stats.failedInventoryPages++;
            stopped = true;
            break;
          }
        }
        const existing = new Map((await allListings()).map((l) => [l.id, l]));
        const detailQueue = [...ids.values()].sort((a, b) =>
          (existing.get(a.id)?.lastDetailAttemptAt || "").localeCompare(
            existing.get(b.id)?.lastDetailAttemptAt || "",
          ),
        );
        for (const l of detailQueue) {
          const old = existing.get(l.id);
          const observed =
            old?.lastDetailObservedAt ||
            (old?.parserVersion.includes("detail") ? old.lastObservedAt : null);
          if (
            observed &&
            Date.now() - Date.parse(observed) <
              (l.saleType === "auction" ? 1 : settings.cacheHours) * 36e5
          ) {
            stats.freshDetailsSkipped++;
            await upsertListing(l);
            continue;
          }
          if (
            caps?.shouldStop?.() ||
            stats.detailRequests >= settings.maxDetails ||
            source.id === "500classic"
          ) {
            await upsertListing(l);
            continue;
          }
          await lease.renew();
          try {
            stats.detailRequests++;
            l.lastDetailAttemptAt = new Date().toISOString();
            const page = await cachedPage(detailUrl(l), {
              origins: source.origins || [new URL(source.url).origin],
              cacheHours:
                l.saleType === "auction"
                  ? Math.min(settings.cacheHours, 1)
                  : settings.cacheHours,
              delayMs: source.delayMs || 10000,
            });
            if (page.cacheHit) stats.cacheHits++;
            await upsertListing(parseDetail(page.html, l, { ...page, scope }));
            stats.detailsSucceeded++;
          } catch (e) {
            stats.failedDetails++;
            stats.failedPages.push(`${l.url}: ${(e as Error).message}`);
            await upsertListing(l);
            if (
              /403|429|challenge|policy|Redirect/.test((e as Error).message)
            ) {
              stopped = true;
              for (const pending of detailQueue.slice(stats.detailRequests))
                await upsertListing(pending);
              break;
            }
          }
        }
        stats.uniqueAds = ids.size;
        stats.skippedCandidates = stats.discoveredCandidates - ids.size;
        stats.remainingEnrichment = Math.max(
          0,
          ids.size - stats.detailsSucceeded - stats.freshDetailsSkipped,
        );
        const status =
          stopped && stats.pagesFetched === 0
            ? "blocked"
            : queue.length ||
                stats.remainingEnrichment ||
                stats.failedPages.length ||
                source.id === "500classic" ||
                (source.id === "autotrader" && scope === "nationwide")
              ? "partial"
              : "complete";
        stats.note = stopped
          ? "Collection stopped before completeness could be established."
          : queue.length
            ? "Inventory page cap reached; queued pages remain."
            : stats.remainingEnrichment
              ? "Inventory read; detail enrichment remains."
              : "Configured scope exhausted.";
        await db.ingestRun.update({
          where: { id: run.id },
          data: {
            status,
            finishedAt: new Date(),
            stats: JSON.stringify(stats),
            error: stats.failedPages[0] || null,
          },
        });
        summaries.push({ source: source.id, status, ...stats });
      } catch (e) {
        await db.ingestRun.update({
          where: { id: run.id },
          data: {
            status: "failed",
            finishedAt: new Date(),
            error: (e as Error).message,
            stats: JSON.stringify(stats),
          },
        });
        summaries.push({
          source: source.id,
          status: "failed",
          error: (e as Error).message,
        });
      }
    }
    await exportSnapshot();
    return { status: "finished", scope, sources: summaries };
  } finally {
    clearInterval(timer);
    await lease.release();
  }
}
