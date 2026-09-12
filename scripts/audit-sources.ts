import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  safeRequest,
  collectionRobotsPolicy,
  cachedPage,
} from "../server/safe-fetch";
import { parseInventory, type SourceConfig } from "../server/ingest/adapters";
import { acquireLease } from "../server/store";
import { db } from "../server/db";
import { reserveServiceRequest } from "../server/service-budget";
import { operations } from "../server/ingest/state";
import { classifyFailure } from "../server/ingest/failures";
const args = process.argv.slice(2);
const only = args.find((a) => a.startsWith("--source="))?.slice(9);
if (args.some((a) => a !== "--catalog" && !a.startsWith("--source=")))
  throw Error("Usage: npm run sources:audit -- [--source=id] [--catalog]");
const sources: SourceConfig[] = JSON.parse(
  await readFile("config/sources.json", "utf8"),
);
if (only && !sources.some((s) => s.id === only))
  throw Error("Unknown source ID");
const checkedAt = new Date().toISOString();
const directory = `data/research/source-audit-${checkedAt.replaceAll(":", "-")}`;
await mkdir(directory, { recursive: true });
const report: Record<string, unknown>[] = [];
let lease: Awaited<ReturnType<typeof acquireLease>> = null;
try {
  lease = await acquireLease("musclescout-collection", 120);
  if (!lease) throw Error("Another collection or audit is running");
  for (const source of sources.filter((s) => !only || s.id === only)) {
    await lease.renew();
    const origin = new URL(source.url).origin;
    const url = origin + "/robots.txt";
    const beforeRequest = async (target: string, delayMs: number) => {
      await lease!.renew();
      await reserveServiceRequest(new URL(target).origin, {
        minIntervalMs: delayMs,
        dailyLimit: 1000,
      });
    };
    const item: Record<string, unknown> = {
      id: source.id,
      checkedAt: new Date().toISOString(),
      robotsUrl: url,
      catalog: "not-tested",
    };
    try {
      await beforeRequest(url, source.delayMs || 10000);
      const response = await safeRequest(url, {
        origins: source.origins || [origin],
      });
      item.httpStatus = response.status;
      item.evidenceSha256 = createHash("sha256")
        .update(response.body)
        .digest("hex");
      await writeFile(`${directory}/${source.id}-robots.txt`, response.body, {
        mode: 0o600,
      });
      if (response.status === 200) {
        const target = source.inventory?.[0] || source.url;
        item.robots = collectionRobotsPolicy(url, response.body, target);
        if (args.includes("--catalog")) {
          if (!source.enabled || !(await operations.allowed(source.id)))
            item.catalog = "disabled-or-paused";
          else if (source.inventory?.[0]) {
            const page = await cachedPage(target, {
              origins: source.origins || [origin],
              cacheHours: 0,
              delayMs: source.delayMs,
              beforeRequest,
            });
            const parsed = parseInventory(page.html, source, {
              ...page,
              scope: "regional",
            });
            item.catalog = {
              url: target,
              observedAt: page.observedAt,
              evidenceSha256: page.hash,
              discovered: parsed.discovered,
              targetAds: parsed.listings.length,
              nextPages: parsed.next.length,
              complete: false,
            };
          }
        }
      }
    } catch (error) {
      item.failure = classifyFailure(error);
    }
    report.push(item);
    console.log(JSON.stringify(item));
  }
  await writeFile(
    directory + "/report.json",
    JSON.stringify(
      { checkedAt, inventoryModified: false, sources: report },
      null,
      2,
    ) + "\n",
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      report: directory + "/report.json",
      inventoryModified: false,
    }),
  );
} finally {
  await lease?.release();
  await db.$disconnect();
}
