import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "..");
let actions = 0;
for (const name of await readdir(path.join(root, ".github/workflows"))) {
  if (!/\.ya?ml$/.test(name)) continue;
  const source = await readFile(
    path.join(root, ".github/workflows", name),
    "utf8",
  );
  for (const match of source.matchAll(/\buses:\s*([^\s#]+)/g)) {
    if (match[1].startsWith("./")) continue;
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.\/-]+@[a-f0-9]{40}$/.test(match[1]))
      throw new Error(
        `${name}: action is not pinned to a full commit: ${match[1]}`,
      );
    actions++;
  }
}
const dockerfile = await readFile(path.join(root, "Dockerfile"), "utf8");
for (const match of dockerfile.matchAll(/^FROM\s+(\S+)/gm))
  if (!/@sha256:[a-f0-9]{64}$/.test(match[1]))
    throw new Error("Docker base image must use an immutable digest");
console.log(
  JSON.stringify({
    actionsPinned: actions,
    dockerDigestPinned: true,
    remoteExecution: false,
  }),
);
