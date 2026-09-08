import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { db } from "../server/db";
import { normalizeObserved } from "../server/ingest/normalize";
import { upsertListing, exportSnapshot } from "../server/store";
const sources = JSON.parse(await readFile("config/sources.json", "utf8"));
const files = [
  "data/research/dealers/observed-listings.json",
  "data/research/marketplaces/all-inventory.json",
];
const grouped = new Map<string, any[]>();
let imported = 0;
for (const file of files) {
  const rows = JSON.parse(await readFile(file, "utf8"));
  for (const raw of rows) {
    const source = sources.find((s: any) => s.id === raw.sourceId);
    const ev = Array.isArray(raw.evidence) ? raw.evidence.at(-1) : raw.evidence;
    const rawFile =
      ev?.privateEvidencePath || ev?.detailFile || ev?.catalogFile;
    let evidenceRef: string | undefined;
    if (rawFile) {
      const filename = rawFile.split("/").pop(),
        folder = file.includes("dealers/") ? "dealers" : "marketplaces",
        privateFile = `data/research/${folder}/${filename}`;
      try {
        const content = await readFile(privateFile);
        evidenceRef = `${privateFile}#sha256:${createHash("sha256").update(content).digest("hex")}`;
      } catch {}
    }
    const listing = normalizeObserved(
      { ...raw, evidenceRef },
      source?.name || raw.sourceId,
    );
    await upsertListing(listing);
    grouped.set(raw.sourceId, [...(grouped.get(raw.sourceId) || []), listing]);
    imported++;
  }
}
for (const [sourceId, listings] of grouped) {
  const id = `initial-research-20260908:${sourceId}`,
    source = sources.find((s: any) => s.id === sourceId),
    details = listings.filter((l) =>
      l.parserVersion.includes("-detail-"),
    ).length,
    starts = listings.map((l) => l.firstSeenAt).sort(),
    ends = listings.map((l) => l.lastObservedAt).sort();
  const pages: Record<string, number> = {
    classiccars: 25,
    volo: 2,
    grauto: 5,
    admcars: 4,
    midwest: 1,
    nsclassics: 6,
    jsmotors: 2,
    "500classic": 1,
    autotrader: 1,
  };
  const stats = {
    pagesDiscovered: pages[sourceId],
    pagesFetched: pages[sourceId],
    detailRequests: details,
    uniqueAds: listings.length,
    remainingEnrichment: listings.length - details,
    cacheHits: 0,
    note:
      "Initial bounded live research collection, imported later with original network timestamps. " +
      source.note,
  };
  await db.ingestRun.upsert({
    where: { id },
    create: {
      id,
      sourceId,
      scope: "regional",
      status: source.status,
      startedAt: new Date(starts[0]),
      finishedAt: new Date(ends.at(-1)),
      stats: JSON.stringify(stats),
    },
    update: { stats: JSON.stringify(stats) },
  });
}
console.log({ imported, snapshot: await exportSnapshot() });
await db.$disconnect();
