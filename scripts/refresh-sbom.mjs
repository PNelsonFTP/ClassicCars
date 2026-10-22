import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
for (const script of [
  "generate-sbom.mjs",
  "sbom-artifacts.mjs",
  "validate-sbom.mjs",
]) {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL(script, import.meta.url))],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
