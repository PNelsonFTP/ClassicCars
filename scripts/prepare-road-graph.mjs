import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, writeFile, readFile, rename, readdir } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
const arg = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const root = path.resolve(import.meta.dirname, ".."),
  folder = path.join(root, "data/routing"),
  sourceUrl =
    "https://download.geofabrik.de/north-america/us-midwest-latest.osm.pbf";
const raw = path.join(folder, "us-midwest-latest.osm.pbf"),
  roads = path.join(folder, "us-midwest-roads.osm.pbf"),
  input = path.resolve(arg("input") || roads),
  graph = input.replace(/\.osm\.pbf$/, ".osrm");
const run = (command, args, capture = false) => {
  const r = spawnSync(command, args, {
    cwd: root,
    stdio: capture ? "pipe" : "inherit",
    encoding: capture ? "utf8" : undefined,
    maxBuffer: 5e6,
  });
  if (r.status !== 0)
    throw Error(
      `${command} failed. Install native OSRM/osmium and inspect its output. ${r.stderr || r.error || ""}`,
    );
  return r.stdout?.trim();
};
if (process.argv.includes("--serve")) {
  const manifest = JSON.parse(
    await readFile(path.join(folder, "manifest.json"), "utf8"),
  );
  const server = spawn(
    "osrm-routed",
    [
      "--ip",
      "127.0.0.1",
      "--port",
      "5015",
      "--threads",
      "2",
      "--algorithm",
      "mld",
      "--mmap=1",
      manifest.localGraph || graph,
    ],
    { stdio: "inherit" },
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => server.kill(signal));
  server.on("exit", (code) => process.exit(code || 0));
} else {
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const osrmVersion = run("osrm-extract", ["--version"], true),
    osmiumVersion = run("osmium", ["--version"], true).split("\n")[0];
  let profile = arg("profile");
  if (!profile) {
    const candidates = [
      "/opt/homebrew/opt/osrm-backend/share/osrm/profiles/car.lua",
      "/usr/local/share/osrm/profiles/car.lua",
      "/usr/share/osrm/profiles/car.lua",
    ];
    profile = candidates.find(existsSync);
  }
  if (!profile)
    throw Error(
      "Pass --profile=/path/to/car.lua from the same OSRM installation.",
    );
  if (!process.argv.includes("--manifest-only")) {
    if (!existsSync(raw) || process.argv.includes("--refresh")) {
      console.log("Downloading public Midwest road extract…");
      const r = await fetch(sourceUrl, { signal: AbortSignal.timeout(900000) });
      if (!r.ok || !r.body) throw Error(`Road download failed: ${r.status}`);
      await pipeline(
        Readable.fromWeb(r.body),
        createWriteStream(raw + ".part", { mode: 0o600 }),
      );
      await rename(raw + ".part", raw);
    }
    if (input === roads)
      run("osmium", [
        "tags-filter",
        raw,
        "w/highway",
        "r/type=restriction",
        "r/route=ferry",
        "-o",
        roads,
        "--overwrite",
      ]);
    for (const [tool, args] of [
      ["osrm-extract", ["-t", "4", "-p", profile, input]],
      ["osrm-partition", ["-t", "4", graph]],
      ["osrm-customize", ["-t", "4", graph]],
    ])
      run(tool, args);
  }
  for (const suffix of [".properties", ".partition", ".cells", ".cell_metrics"])
    if (!existsSync(graph + suffix))
      throw Error(`Incomplete road graph: missing ${suffix}`);
  const observedAt = run(
    "osmium",
    ["fileinfo", "-g", "header.option.osmosis_replication_timestamp", input],
    true,
  );
  if (!Number.isFinite(Date.parse(observedAt)))
    throw Error("Road timestamp is missing; do not guess its age.");
  const inputHash = createHash("sha256");
  for await (const bytes of createReadStream(input)) inputHash.update(bytes);
  const pbfSha256 = inputHash.digest("hex");
  const profileHash = createHash("sha256");
  async function profileTree(folder) {
    for (const name of (await readdir(folder, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const file = path.join(folder, name.name);
      if (name.isDirectory()) await profileTree(file);
      else if (name.name.endsWith(".lua"))
        profileHash.update(await readFile(file));
    }
  }
  await profileTree(path.dirname(profile));
  const profileSha256 = profileHash.digest("hex");
  const version = createHash("sha256")
    .update(
      JSON.stringify({
        osrmVersion,
        pbfSha256,
        profileSha256,
        profile: "car-no-ferries-us-v1",
      }),
    )
    .digest("hex");
  const manifest = {
    version,
    sourceUrl,
    observedAt,
    profile: "car-no-ferries-us-v1",
    region: "US Midwest",
    attribution:
      "© OpenStreetMap contributors. Traffic-free OSRM city routes; ferries excluded; US regional graph.",
    licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
    localGraph: graph,
    tooling: {
      osrmVersion,
      osmiumVersion,
      profileSha256,
      pbfSha256,
      filter: ["w/highway", "r/type=restriction", "r/route=ferry"],
      preparedAt: new Date().toISOString(),
    },
  };
  await writeFile(
    path.join(folder, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    { mode: 0o600 },
  );
  console.log(JSON.stringify(manifest, null, 2));
}
