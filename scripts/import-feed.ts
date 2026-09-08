import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parseAuthorizedFeed } from "../server/ingest/authorized-feed";
const filename = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!filename)
  throw new Error("Usage: npm run import:feed -- provider-feed.json [--apply]");
const bytes = await readFile(filename);
if (bytes.byteLength > 20e6)
  throw new Error("Feed exceeds the 20 MB bounded import size");
const digest = createHash("sha256").update(bytes).digest("hex");
const parsed = parseAuthorizedFeed(JSON.parse(bytes.toString("utf8")));
console.log(
  JSON.stringify(
    {
      dryRun: !process.argv.includes("--apply"),
      feedId: parsed.manifest.feedId,
      coverage: parsed.coverage,
      rejected: parsed.rejected,
      publicRedistribution: parsed.manifest.authorization.publicRedistribution,
    },
    null,
    2,
  ),
);
if (process.argv.includes("--apply")) {
  if (parsed.rejected.length)
    throw new Error(
      "Correct rejected rows before applying this feed page; no rows were imported",
    );
  const { db } = await import("../server/db");
  const { upsertListing, acquireLease } = await import("../server/store");
  const receiptKey = `feed-receipt:${parsed.manifest.feedId}:${digest}`;
  const checkpointKey = `feed-progress:${parsed.manifest.feedId}:${parsed.manifest.scope}:${createHash("sha256").update(parsed.manifest.query).digest("hex")}`;
  let lease: Awaited<ReturnType<typeof acquireLease>> = null;
  try {
    lease = await acquireLease("musclescout-collection");
    if (!lease)
      throw new Error(
        "Another collection is running; retry the import after it finishes",
      );
    if (await db.setting.findUnique({ where: { key: receiptKey } })) {
      console.log(
        "This exact feed page was already imported; preserved its prior observation times.",
      );
    } else {
      const old = await db.setting.findUnique({
        where: { key: checkpointKey },
      });
      const prior = old && JSON.parse(old.value);
      const page = parsed.manifest.pagination;
      const continuous = prior
        ? prior.continuous && prior.nextCursor === page.cursor
        : page.cursor === null || page.cursor === "0";
      for (const [index, listing] of parsed.listings.entries()) {
        if (index % 100 === 0) await lease.renew();
        await upsertListing(listing);
      }
      const receipt = {
        manifest: parsed.manifest,
        sha256: digest,
        importedAt: new Date().toISOString(),
        accepted: parsed.listings.length,
        queryComplete: continuous && page.terminal,
      };
      await db.$transaction([
        db.setting.upsert({
          where: { key: checkpointKey },
          create: {
            key: checkpointKey,
            value: JSON.stringify({ ...page, continuous }),
          },
          update: { value: JSON.stringify({ ...page, continuous }) },
        }),
        db.setting.create({
          data: { key: receiptKey, value: JSON.stringify(receipt) },
        }),
        db.ingestRun.create({
          data: {
            sourceId: parsed.manifest.sourceId,
            scope: parsed.manifest.scope,
            status: receipt.queryComplete ? "complete" : "partial",
            finishedAt: new Date(),
            stats: JSON.stringify({
              importedFeed: true,
              feedId: parsed.manifest.feedId,
              uniqueAds: parsed.listings.length,
              query: parsed.manifest.query,
              observedAt: parsed.manifest.generatedAt,
              declaredTotal: page.declaredTotal,
              continuous,
              terminal: page.terminal,
              note: "Completeness describes only the declared feed query; absence never removes prior ads.",
            }),
          },
        }),
      ]);
      console.log(
        JSON.stringify({
          accepted: parsed.listings.length,
          queryComplete: receipt.queryComplete,
          nextCursor: page.nextCursor,
          publicSnapshotRegenerated: false,
        }),
      );
    }
  } finally {
    await lease?.release();
    await db.$disconnect();
  }
}
