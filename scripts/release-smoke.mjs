import {
  mkdtemp,
  readFile,
  writeFile,
  cp,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const argument = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const root = path.resolve(
    argument("root") || path.join(import.meta.dirname, ".."),
  ),
  temporary = await mkdtemp(path.join(tmpdir(), "musclescout-release-"));
const setupScript =
  argument("setup-script") || path.join(root, "scripts/setup.ts");
const tsxLoader = pathToFileURL(
  path.join(root, "node_modules/tsx/dist/loader.mjs"),
).href;
const env = {
  ...process.env,
  DATABASE_URL: `file:${path.join(temporary, "data/live.db").split(path.sep).join("/")}`,
  MUSCLESCOUT_PASSWORD: "isolated-release-smoke",
  MUSCLESCOUT_API_PORT: "4418",
  MUSCLESCOUT_ALLOWED_ORIGINS: "http://127.0.0.1:3100",
};
const hash = (data) => createHash("sha256").update(data).digest("hex");
function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: temporary,
    env,
    encoding: "utf8",
    timeout: 120000,
  });
  if (result.status !== 0)
    throw new Error(
      `Smoke subprocess failed (${args.join(" ")}): ${result.stderr || result.stdout || result.error}`,
    );
  return result.stdout;
}
let api;
try {
  await symlink(
    path.join(root, "node_modules"),
    path.join(temporary, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await cp(path.join(root, "prisma"), path.join(temporary, "prisma"), {
    recursive: true,
  });
  await cp(
    path.join(root, ".env.example"),
    path.join(temporary, ".env.example"),
  );
  await cp(
    path.join(root, "prisma.config.ts"),
    path.join(temporary, "prisma.config.ts"),
  );
  // Scripts resolve modules from the original checkout while all mutable cwd data stays isolated.
  await writeFile(
    path.join(temporary, ".env"),
    "MUSCLESCOUT_PASSWORD=isolated-release-smoke\n",
  );
  const before = hash(await readFile(path.join(temporary, ".env")));
  run(["--import", tsxLoader, setupScript]);
  run(["--import", tsxLoader, setupScript]);
  assert.equal(hash(await readFile(path.join(temporary, ".env"))), before);
  const Database = createRequire(path.join(root, "package.json"))(
      "better-sqlite3",
    ),
    db = new Database(path.join(temporary, "data/live.db"));
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  assert.equal(db.prepare("SELECT COUNT(*) n FROM Workspace").get().n, 1);
  db.prepare(
    "INSERT INTO Setting (key,value) VALUES ('release-smoke','preserved')",
  ).run();
  const backup = path.join(temporary, "backup.db");
  await db.backup(backup);
  db.close();
  const restored = new Database(backup);
  assert.equal(
    restored
      .prepare("SELECT value FROM Setting WHERE key='release-smoke'")
      .get().value,
    "preserved",
  );
  assert.equal(restored.pragma("integrity_check", { simple: true }), "ok");
  restored.close();
  api = spawn(
    process.execPath,
    ["--import", tsxLoader, path.join(root, "server/index.ts")],
    { cwd: root, env, stdio: "ignore" },
  );
  let healthy = false;
  for (let i = 0; i < 100; i++) {
    if (api.exitCode !== null)
      throw new Error("API exited before health check");
    try {
      healthy = (await fetch("http://127.0.0.1:4418/health")).ok;
    } catch {}
    if (healthy) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(healthy, true);
  api.kill("SIGTERM");
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("API shutdown timeout")),
      10000,
    );
    api.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
  console.log(
    JSON.stringify({
      node: process.version,
      platform: process.platform,
      architecture: process.arch,
      setupTwice: true,
      passwordPreserved: true,
      migrations: true,
      nativeSqlite: true,
      backupRestore: true,
      apiStartupShutdown: true,
    }),
  );
} finally {
  if (api?.exitCode === null) api.kill("SIGTERM");
  await rm(temporary, { recursive: true, force: true });
}
