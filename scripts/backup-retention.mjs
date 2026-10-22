import { readdir, readFile, stat, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
// Advisory only: no deletion mode. Recovery pairs and evidence remain until separately approved.
const root = path.resolve(
  process.argv.find((a) => a.startsWith("--root="))?.slice(7) || "backups",
);
const files = await readdir(root),
  pairs = [];
for (const file of files
  .filter((n) => /^musclescout-[0-9TZ-]+\.db$/.test(n))
  .sort()) {
  const env = file.replace(/\.db$/, ".env");
  if ((await lstat(path.join(root, file))).isSymbolicLink())
    throw Error("Backup symlinks are not accepted");
  const bytes = await stat(path.join(root, file));
  if (!files.includes(env)) {
    pairs.push({
      database: file,
      bytes: bytes.size,
      status: "keep-incomplete-pair-review",
    });
    continue;
  }
  const hash = createHash("sha256");
  for await (const chunk of (await import("node:fs")).createReadStream(
    path.join(root, file),
  ))
    hash.update(chunk);
  const envBytes = await readFile(path.join(root, env));
  pairs.push({
    database: file,
    environment: env,
    bytes: bytes.size + envBytes.length,
    dbSha256: hash.digest("hex"),
    envSha256: createHash("sha256").update(envBytes).digest("hex"),
    status: "keep-unique-recovery-state",
  });
}
const seen = new Map();
for (const pair of pairs) {
  if (!pair.dbSha256) continue;
  const key = pair.dbSha256 + ":" + pair.envSha256;
  if (seen.has(key)) {
    pair.status = "duplicate-pair-review-only";
    pair.retainedCopy = seen.get(key);
  } else seen.set(key, pair.database);
}
console.log(
  JSON.stringify(
    {
      dryRun: true,
      deletionSupported: false,
      policy: {
        minimumRecentDailyPairs: 7,
        minimumWeeklyPairs: 8,
        minimumMonthlyPairs: 12,
        keepBeforeMigration: true,
        keepUniqueRecoveryStates: true,
        evidence:
          "Keep current release evidence, failed-access observations and every Low-confidence cleanup candidate; archive other old successful run evidence only after approval.",
      },
      pairs,
      totalBytes: pairs.reduce((s, p) => s + p.bytes, 0),
      candidateDuplicateBytes: pairs
        .filter((p) => p.status === "duplicate-pair-review-only")
        .reduce((s, p) => s + p.bytes, 0),
    },
    null,
    2,
  ),
);
