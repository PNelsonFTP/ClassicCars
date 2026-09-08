import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { db } from "../server/db";
import { allListings, getSettings } from "../server/store";
import { operations } from "../server/ingest/state";
import {
  buildScopeValidationReport,
  scopeReportMarkdown,
} from "../server/ingest/scope-validation";
try {
  const args = process.argv.slice(2),
    output = args.find((arg) => !arg.startsWith("--"));
  const [sources, listings, progress, runs, settings] = await Promise.all([
    readFile("config/sources.json", "utf8").then(JSON.parse),
    allListings(),
    operations.progress(),
    db.ingestRun.findMany(),
    getSettings(),
  ]);
  const report = buildScopeValidationReport({
    sources,
    listings,
    catalogs: progress.catalogs,
    runs,
    settings,
  });
  if (output) {
    const base = path.resolve(output).replace(/\.(json|md)$/i, "");
    await mkdir(path.dirname(base), { recursive: true });
    await writeFile(base + ".json", JSON.stringify(report, null, 2) + "\n", {
      mode: 0o600,
    });
    await writeFile(base + ".md", scopeReportMarkdown(report), { mode: 0o600 });
    console.log(
      JSON.stringify(
        {
          json: base + ".json",
          markdown: base + ".md",
          generatedAt: report.generatedAt,
          nationwideCompleteness: report.nationwideCompleteness,
        },
        null,
        2,
      ),
    );
  } else console.log(JSON.stringify(report, null, 2));
} finally {
  await db.$disconnect();
}
