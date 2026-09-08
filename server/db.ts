import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "node:path";
import { mkdirSync } from "node:fs";
const url =
  process.env.DATABASE_URL || `file:${path.resolve("data/musclescout.db")}`;
mkdirSync("data", { recursive: true });
export const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url }),
});
