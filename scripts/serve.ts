import "dotenv/config";
import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
const folder = path.resolve(process.env.MUSCLESCOUT_STATIC_DIR || "out"),
  base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, ""),
  port = Number(process.env.MUSCLESCOUT_WEB_PORT || 3100);
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url || "/", "http://localhost");
    if (base && u.pathname !== base && !u.pathname.startsWith(base + "/"))
      throw new Error("Not found");
    let requested = decodeURIComponent(u.pathname.slice(base.length));
    if (requested.endsWith("/") || !path.extname(requested))
      requested += "/index.html";
    const file = path.resolve(folder, "." + requested.replace(/\/+/g, "/"));
    if (!file.startsWith(folder + path.sep)) throw new Error("Not found");
    const bytes = await readFile(file);
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(bytes);
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});
server.listen(port, process.env.MUSCLESCOUT_BIND_HOST || "127.0.0.1", () =>
  console.log(`MuscleScout static export: http://127.0.0.1:${port}${base}/`),
);
server.on("error", (e) => {
  console.error(
    "Port unavailable; existing applications left running.",
    e.message,
  );
  process.exitCode = 1;
});
