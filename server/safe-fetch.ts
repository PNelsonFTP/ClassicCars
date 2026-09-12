import { FetchFailure, failureFromResponse } from "./ingest/failures";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import robotsParser from "robots-parser";
export const agent =
  "MuscleScout/1.1 (+https://github.com/PNelsonFTP/ClassicCars; deterministic inventory collector)";
export const accept =
  "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8";

// Match our declared product token. GPTBot/ChatGPT-User rules describe other
// clients; provider terms and source enablement are separate access decisions.
export function collectionRobotsPolicy(
  robotsUrl: string,
  body: string,
  url: string,
) {
  if (/<(?:html|!doctype)/i.test(body))
    throw new FetchFailure(
      "Robots endpoint returned HTML instead of a policy; review required.",
      "policy",
    );
  const parsed = robotsParser(robotsUrl, body);
  return {
    allowed: parsed.isAllowed(url, "MuscleScout") !== false,
    delayMs: (parsed.getCrawlDelay("MuscleScout") || 0) * 1000,
  };
}
export function publicAddress(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && [0, 168].includes(b)) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && [18, 19, 51].includes(b)) ||
      (a === 203 && b === 0) ||
      a >= 224
    );
  }
  return (
    isIP(ip) === 6 && /^2[0-9a-f]{3}:/i.test(ip) && !/^2001:(db8|0:)/i.test(ip)
  );
}
export async function validateUrl(raw: string, allowedOrigins?: string[]) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  )
    throw new Error(
      "Only credential-free HTTPS URLs on port 443 are supported.",
    );
  if (allowedOrigins && !allowedOrigins.includes(url.origin))
    throw new Error("Source origin is not allowlisted.");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error("Private or reserved network destination blocked.");
  return { url, address: addresses[0] };
}
export async function safeRequest(
  raw: string,
  options: {
    origins?: string[];
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    maxBytes?: number;
    redirects?: number;
  } = {},
): Promise<{ body: string; status: number; headers: Record<string, unknown> }> {
  const { url, address } = await validateUrl(raw, options.origins);
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: options.method || "GET",
        headers: {
          "User-Agent": agent,
          Accept: accept,
          ...options.headers,
        },
        lookup: ((
          _hostname: unknown,
          opts: { all?: boolean },
          callback: (...args: unknown[]) => void,
        ) =>
          opts.all
            ? callback(null, [
                { address: address.address, family: address.family },
              ])
            : callback(null, address.address, address.family)) as never,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
          res.resume();
          const destination = res.headers.location
            ? new URL(res.headers.location, url)
            : null;
          if (
            !destination ||
            destination.origin !== url.origin ||
            (options.redirects || 0) >= 3 ||
            (options.method && options.method !== "GET")
          ) {
            reject(
              new Error("Unexpected-origin or unsupported redirect blocked."),
            );
            return;
          }
          safeRequest(destination.href, {
            ...options,
            redirects: (options.redirects || 0) + 1,
          }).then(resolve, reject);
          return;
        }
        let total = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > (options.maxBytes || 6e6)) {
            req.destroy(new Error("Response exceeds configured size limit."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            body: Buffer.concat(chunks).toString("utf8"),
            status: res.statusCode || 0,
            headers: res.headers,
          }),
        );
      },
    );
    req.setTimeout(25000, () =>
      req.destroy(new Error("Source request timed out.")),
    );
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}
type Cached = {
  url: string;
  observedAt: string;
  lastNetworkCheckedAt: string;
  hash: string;
};
const times = new Map<string, number>();
export async function throttled(
  raw: string,
  delayMs: number,
  options: Parameters<typeof safeRequest>[1] = {},
) {
  const origin = new URL(raw).origin;
  const wait = Math.max(0, (times.get(origin) || 0) + delayMs - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  times.set(origin, Date.now());
  return safeRequest(raw, options);
}
export async function cachedPage(
  url: string,
  {
    origins,
    cacheHours = 24,
    delayMs = 10000,
    robots = true,
    beforeRequest,
  }: {
    origins: string[];
    cacheHours?: number;
    delayMs?: number;
    robots?: boolean;
    beforeRequest?: (url: string, delayMs: number) => Promise<void>;
  },
): Promise<Cached & { html: string; cacheHit: boolean }> {
  const key = createHash("sha256").update(url).digest("hex"),
    folder = "data/cache";
  await mkdir(folder, { recursive: true });
  try {
    const cache = JSON.parse(
      await readFile(`${folder}/${key}.json`, "utf8"),
    ) as Cached;
    if (Date.now() - Date.parse(cache.observedAt) < cacheHours * 36e5)
      return {
        ...cache,
        html: await readFile(`${folder}/${cache.hash}.html`, "utf8"),
        cacheHit: true,
      };
  } catch {}
  if (robots) {
    const origin = new URL(url).origin;
    const rules = await cachedPage(`${origin}/robots.txt`, {
      origins,
      cacheHours: 24,
      delayMs,
      robots: false,
      beforeRequest,
    });
    const policy = collectionRobotsPolicy(
      `${origin}/robots.txt`,
      rules.html,
      url,
    );
    if (!policy.allowed)
      throw new FetchFailure(
        "Robots policy disallows this path for MuscleScout.",
        "policy",
      );
    delayMs = Math.max(delayMs, policy.delayMs);
  }
  const response = beforeRequest
    ? (await beforeRequest(url, delayMs), await safeRequest(url, { origins }))
    : await throttled(url, delayMs, { origins });
  if (response.status !== 200)
    throw failureFromResponse(response.status, response.headers);
  if (
    /<title[^>]*>\s*(just a moment|access denied|attention required|verify you are human|autotrader[^<]*page unavailable)|id=["\']challenge-form["\']|cf-chl-container/i.test(
      response.body,
    ) &&
    robots
  )
    throw new FetchFailure(
      "Access challenge; stopped without bypass.",
      "access",
      response.status,
    );
  const observedAt = new Date().toISOString();
  const hash = createHash("sha256").update(response.body).digest("hex");
  const metadata = { url, observedAt, lastNetworkCheckedAt: observedAt, hash };
  await writeFile(`${folder}/${hash}.html`, response.body, { mode: 0o600 });
  await writeFile(`${folder}/${key}.json`, JSON.stringify(metadata), {
    mode: 0o600,
  });
  return { ...metadata, html: response.body, cacheHit: false };
}
