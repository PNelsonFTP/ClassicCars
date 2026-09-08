import { spawnSync } from "node:child_process";
import { cp, rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const root = path.resolve(import.meta.dirname, ".."),
  saved = await mkdtemp(path.join(tmpdir(), "musclescout-root-export-"));
const build = (base) => {
  const result = spawnSync(
    process.execPath,
    [path.join(root, "node_modules/next/dist/bin/next"), "build", "--webpack"],
    {
      cwd: root,
      env: { ...process.env, NEXT_PUBLIC_BASE_PATH: base },
      stdio: "inherit",
    },
  );
  if (result.status !== 0)
    throw new Error(`Static export failed for ${base || "/"}`);
};
let rootSaved = false;
try {
  build("");
  await cp(path.join(root, "out"), path.join(saved, "out"), {
    recursive: true,
  });
  rootSaved = true;
  build("/ClassicCars");
  await rm(path.join(root, "out-subpath"), { recursive: true, force: true });
  await cp(path.join(root, "out"), path.join(root, "out-subpath"), {
    recursive: true,
  });
} finally {
  if (rootSaved) {
    await rm(path.join(root, "out"), { recursive: true, force: true });
    await cp(path.join(saved, "out"), path.join(root, "out"), {
      recursive: true,
    });
  }
  await rm(saved, { recursive: true, force: true });
}
console.log(
  "Root and /ClassicCars exports built; root output restored to out.",
);
