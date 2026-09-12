import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { sourceFeedTemplate } from "../server/ingest/feed-template";
import type { SourceConfig } from "../server/ingest/adapters";
const [id, output] = process.argv.slice(2);
if (!id || !output)
  throw Error(
    "Usage: npm run sources:feed-template -- source-id data/feeds/provider.json",
  );
const sources: SourceConfig[] = JSON.parse(
  await readFile("config/sources.json", "utf8"),
);
const source = sources.find((s) => s.id === id);
if (!source) throw Error("Unknown source ID");
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  JSON.stringify(sourceFeedTemplate(source), null, 2) + "\n",
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Created incomplete private template. Fill real authorization, timestamps, query, host allowlists and records before import:feed. Publication defaults to disabled.",
);
