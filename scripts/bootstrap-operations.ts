import "dotenv/config";
import { readFile } from "node:fs/promises";
import { db } from "../server/db";
import { allListings } from "../server/store";
import { operations } from "../server/ingest/state";
import { bootstrapLegacyOperations } from "../server/ingest/bootstrap-operations";
try {
  const [sources, listings, runs] = await Promise.all([
    readFile("config/sources.json", "utf8").then(JSON.parse),
    allListings(),
    db.ingestRun.findMany(),
  ]);
  console.log(
    JSON.stringify(
      await bootstrapLegacyOperations(operations, { sources, listings, runs }),
      null,
      2,
    ),
  );
} finally {
  await db.$disconnect();
}
