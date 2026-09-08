import "dotenv/config";
import { readFile, writeFile, mkdir, copyFile, chmod } from "node:fs/promises";
import { db } from "../server/db";
import { collect } from "../server/ingest/collector";
import {
  getSettings,
  saveSettings,
  upsertListing,
  exportSnapshot,
} from "../server/store";
import { settingsSchema } from "../shared/schema";
import { geocodeListings, routeListings } from "../server/geography";
const [command, ...args] = process.argv.slice(2),
  limit = Number(
    args.find((a) => a.startsWith("--limit="))?.split("=")[1] || 20,
  );
try {
  if (command === "collect")
    console.log(
      JSON.stringify(
        await collect(
          args.includes("--nationwide") ? "nationwide" : "regional",
          args.find((a) => a.startsWith("--source="))?.split("=")[1],
          {
            pageCap:
              Number(
                args.find((a) => a.startsWith("--pages="))?.split("=")[1] ||
                  (args.includes("--smoke") ? 1 : 0),
              ) || undefined,
            detailCap:
              Number(
                args.find((a) => a.startsWith("--details="))?.split("=")[1] ||
                  (args.includes("--smoke") ? 1 : 0),
              ) || undefined,
          },
        ),
        null,
        2,
      ),
    );
  else if (command === "geocode") console.log(await geocodeListings(limit));
  else if (command === "route") console.log(await routeListings(limit));
  else if (command === "snapshot") console.log(await exportSnapshot());
  else if (command === "import") {
    const filename = args.find((a) => !a.startsWith("--"));
    if (!filename)
      throw new Error(
        "Usage: npm run import:listings -- path/to/listings.json",
      );
    const raw = JSON.parse(await readFile(filename, "utf8")),
      rows = Array.isArray(raw) ? raw : raw.listings;
    let accepted = 0;
    const rejected = [];
    for (const [i, l] of rows.entries())
      try {
        await upsertListing(l);
        accepted++;
      } catch (e) {
        rejected.push({ index: i, reason: (e as Error).message });
      }
    console.log({ accepted, rejected });
  } else if (command === "config") {
    const filename = args.find((a) => !a.startsWith("--"));
    const settings = filename
      ? settingsSchema.parse(JSON.parse(await readFile(filename, "utf8")))
      : await getSettings();
    if (filename && !args.includes("--dry-run")) await saveSettings(settings);
    console.log(
      JSON.stringify({ dryRun: args.includes("--dry-run"), settings }, null, 2),
    );
  } else if (command === "backup") {
    await mkdir("backups", { recursive: true, mode: 0o700 });
    await chmod("backups", 0o700);
    const name = `backups/musclescout-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    await db.$executeRawUnsafe(`VACUUM INTO '${name}.db'`);
    await copyFile(".env", `${name}.env`);
    await chmod(`${name}.db`, 0o600);
    await chmod(`${name}.env`, 0o600);
    console.log(`Backup created: ${name}.db and .env. Keep both private.`);
  } else throw new Error("Unknown command");
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
