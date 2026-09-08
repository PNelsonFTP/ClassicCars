import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url:
      "file:" +
      path.resolve(
        (process.env.DATABASE_URL || "file:./data/musclescout.db").replace(
          /^file:/,
          "",
        ),
      ),
  },
});
