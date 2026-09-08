import {
  mkdtempSync,
  readFileSync,
  rmSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const folder = mkdtempSync(join(tmpdir(), "musclescout-e2e-"));
process.env.DATABASE_URL = `file:${folder}/musclescout-e2e.db`;
process.env.MUSCLESCOUT_PASSWORD = "musclescout-e2e-only";
const Database = createRequire(import.meta.url)("better-sqlite3"),
  sqlite = new Database(`${folder}/musclescout-e2e.db`);
for (const d of readdirSync("prisma/migrations").sort()) {
  const f = "prisma/migrations/" + d + "/migration.sql";
  if (existsSync(f)) sqlite.exec(readFileSync(f, "utf8"));
}
sqlite.close();
const { buildApi } = await import("../server/api"),
  { db } = await import("../server/db"),
  { upsertListing } = await import("../server/store");
await upsertListing({
  id: "e2e:mustang",
  sourceId: "e2e",
  sourceListingId: "mustang",
  sourceName: "Isolated browser fixture",
  url: "https://example.com/musclescout-test",
  title: "1967 Ford Mustang · browser test fixture",
  year: 1967,
  model: "Mustang",
  askingPrice: 25000,
  saleType: "fixed",
  availability: "active",
  seller: { name: "Browser test fixture", type: "dealer" },
  firstSeenAt: new Date().toISOString(),
  lastObservedAt: new Date().toISOString(),
});
const app = await buildApi();
await app.listen({ host: "127.0.0.1", port: 4411 });
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await app.close();
    await db.$disconnect();
    rmSync(folder, { recursive: true, force: true });
    process.exit();
  });
