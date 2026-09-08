import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";
await mkdir("data", { recursive: true });
await chmod("data", 0o700);
if (!existsSync(".env")) {
  const template = await readFile(".env.example", "utf8");
  await writeFile(
    ".env",
    template.replace(
      "MUSCLESCOUT_PASSWORD=",
      "MUSCLESCOUT_PASSWORD=" + randomBytes(24).toString("base64url"),
    ),
    { mode: 0o600 },
  );
  console.log("Created private .env with a generated MuscleScout password.");
} else {
  const current = await readFile(".env", "utf8");
  if (!/^MUSCLESCOUT_PASSWORD=\S+/m.test(current)) {
    await writeFile(
      ".env",
      current.replace(/^MUSCLESCOUT_PASSWORD=.*$/m, "") +
        "\nMUSCLESCOUT_PASSWORD=" +
        randomBytes(24).toString("base64url") +
        "\n",
      { mode: 0o600 },
    );
  }
  console.log("Preserved existing settings and password.");
}
config({ quiet: true });
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const { db: initialDb } = await import("../server/db");
await initialDb.$queryRawUnsafe("SELECT 1");
await initialDb.$disconnect();
for (const args of [
  ["prisma", "generate"],
  ["prisma", "migrate", "deploy"],
]) {
  const r = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (r.status !== 0) process.exit(r.status || 1);
}
const { db } = await import("../server/db"),
  { settingsSchema, emptyWorkspace } = await import("../shared/schema");
const settings = settingsSchema.parse({
  specialtyYearReference:
    "https://www.fromtheroad.ford.com/us/en/articles/2026/mustang-gtd-applications-open-april-17",
});
await db.setting.upsert({
  where: { key: "settings" },
  create: { key: "settings", value: JSON.stringify(settings) },
  update: {},
});
await db.workspace.upsert({
  where: { id: "personal" },
  create: { id: "personal", payload: JSON.stringify(emptyWorkspace()) },
  update: {},
});
await db.setting.upsert({
  where: { key: "last-collection" },
  create: { key: "last-collection", value: new Date().toISOString() },
  update: {},
});
await db.$disconnect();
console.log(
  "MuscleScout ready. Run npm run dev. Read MUSCLESCOUT_PASSWORD in .env to connect; it is not printed or published.",
);
