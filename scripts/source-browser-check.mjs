// Isolated, deterministic browser diagnostic; no login, stealth or challenge solving.
import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
import {
  safeRequest,
  collectionRobotsPolicy,
  agent,
  validateUrl,
} from "../server/safe-fetch.ts";
const urls = process.argv.slice(2);
if (!urls.length || urls.length > 8)
  throw Error("Provide 1–8 public HTTPS catalog URLs");
const browser = await chromium.launch({ headless: true });
await mkdir("data/research/browser-access", { recursive: true });
try {
  for (const raw of urls) {
    const { url } = await validateUrl(raw);
    const policy = await safeRequest(new URL("/robots.txt", url).href, {
      origins: [url.origin],
    });
    if (
      policy.status !== 200 ||
      !collectionRobotsPolicy(
        new URL("/robots.txt", url).href,
        policy.body,
        url.href,
      ).allowed
    ) {
      console.log(
        JSON.stringify({
          url: raw,
          result: "robots-unavailable-or-disallowed",
        }),
      );
      continue;
    }
    const context = await browser.newContext({
      userAgent: `Mozilla/5.0 (compatible; ${agent})`,
      serviceWorkers: "block",
    });
    const delay = Math.max(
      10000,
      collectionRobotsPolicy(
        new URL("/robots.txt", url).href,
        policy.body,
        url.href,
      ).delayMs,
    );
    if (delay > 60000) {
      await context.close();
      console.log(
        JSON.stringify({
          url: raw,
          result: "crawl-delay-exceeds-diagnostic-budget",
        }),
      );
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    let requests = 0;
    // Only this public origin; never use a user's profile, cookies or credentials.
    await context.route("**/*", async (route) => {
      const request = route.request();
      const target = new URL(request.url());
      if (++requests > 80) return route.abort();
      if (target.origin !== url.origin || request.method() !== "GET")
        return route.abort();
      try {
        await validateUrl(target.href, [url.origin]);
        if (
          !collectionRobotsPolicy(
            new URL("/robots.txt", url).href,
            policy.body,
            target.href,
          ).allowed
        )
          return route.abort();
        await route.continue();
      } catch {
        await route.abort();
      }
    });
    const page = await context.newPage();
    try {
      const response = await page.goto(url.href, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      const html = await page.content();
      const challenge =
        /captcha|cf-chl-|challenge-form|access denied|verify you are human|page unavailable/i.test(
          (await page.title()) +
            " " +
            (await page.locator("body").innerText()).slice(0, 2000),
        );
      const file = `data/research/browser-access/${url.hostname}-${Date.now()}.html`;
      await writeFile(file, html, { mode: 0o600 });
      console.log(
        JSON.stringify({
          url: raw,
          status: response?.status(),
          title: await page.title(),
          challenge,
          bytes: html.length,
          file,
          observedAt: new Date().toISOString(),
        }),
      );
    } catch (e) {
      console.log(JSON.stringify({ url: raw, error: String(e) }));
    }
    await context.close();
  }
} finally {
  await browser.close();
}
