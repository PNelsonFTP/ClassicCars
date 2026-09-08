import http from "node:http";
import path from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
const types: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url!, "http://localhost").pathname;
    const subpath = pathname.startsWith("/ClassicCars/");
    const folder = path.resolve(subpath ? "out-subpath" : "out");
    let route = decodeURIComponent(subpath ? pathname.slice(12) : pathname);
    if (route.endsWith("/")) route += "index.html";
    const file = path.resolve(folder, "." + route);
    if (!file.startsWith(folder + path.sep)) throw new Error("Invalid path");
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.statusCode = 404;
    res.end("Not found");
  }
});
await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(3160, "127.0.0.1", resolve);
});
const browser = await chromium.launch();
const results: object[] = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const root = await context.newPage();
  await mkdir("test-results", { recursive: true });
  for (const base of ["", "/ClassicCars"]) {
    const page = base ? await context.newPage() : root;
    const errors: string[] = [],
      missing: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().startsWith("http://127.0.0.1:3160") && r.status() >= 400)
        missing.push(r.url());
    });
    await page.goto(`http://127.0.0.1:3160${base}/`);
    await page
      .getByRole("button", { name: "Review cars", exact: true })
      .click();
    await page.locator(".car-card").first().waitFor();
    await page.getByRole("textbox", { name: "Search cars" }).fill("Camero");
    assert.match(
      await page.locator(".car-card").first().innerText(),
      /Camaro|Camero/i,
    );
    await page.getByRole("textbox", { name: "Search cars" }).fill("");
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll(".car-card img")).some(
        (i) =>
          (i as HTMLImageElement).complete &&
          (i as HTMLImageElement).naturalWidth > 0,
      ),
    );
    if (!base) {
      await page.evaluate(() =>
        localStorage.setItem(
          "boatscout:/BoatMarket:workspace",
          "independent-test-sentinel",
        ),
      );
      await page.locator(".car-card .favorite").first().click();
    } else {
      await page.getByRole("button", { name: /Shortlist/ }).click();
      assert.equal(await page.locator(".car-card").count(), 0);
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem("boatscout:/BoatMarket:workspace"),
        ),
        "independent-test-sentinel",
      );
      await page.getByRole("button", { name: "Discover", exact: true }).click();
    }
    await page.locator(".car-photo").evaluateAll(async (images) => {
      await Promise.all(
        images
          .slice(0, 3)
          .map((i) => (i as HTMLImageElement).decode().catch(() => {})),
      );
    });
    await page.screenshot({
      path: `test-results/export-${base ? "subpath" : "root"}.png`,
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(missing, []);
    results.push({
      base: base || "/",
      runtimeErrors: errors.length,
      missingLocalAssets: missing.length,
      realImageLoaded: true,
    });
  }
  await root.reload();
  await root.getByRole("button", { name: /Shortlist/ }).click();
  assert.equal(await root.locator(".car-card").count(), 1);
  results.push({
    storage:
      "root/subpath snapshot workspaces isolated; separate app sentinel preserved",
  });
  await writeFile(
    "test-results/export-validation.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
