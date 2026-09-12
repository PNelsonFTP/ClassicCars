import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { collectionRobotsPolicy, accept, agent } from "../server/safe-fetch";
import { parseInventory, type SourceConfig } from "../server/ingest/adapters";
const sources: SourceConfig[] = JSON.parse(
  readFileSync("config/sources.json", "utf8"),
);
const url = "https://example.com/cars";
const policy = (text: string) =>
  collectionRobotsPolicy("https://example.com/robots.txt", text, url);
describe("actual collector identity and source evidence", () => {
  it("does not inherit rules for a different named bot", () => {
    expect(
      policy("User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /")
        .allowed,
    ).toBe(true);
    expect(agent).toMatch(/^MuscleScout\//);
    expect(accept).toContain("text/plain");
  });
  it("honors wildcard denials, own denials and crawl delays", () => {
    expect(policy("User-agent: *\nDisallow: /cars").allowed).toBe(false);
    expect(
      policy("User-agent: MuscleScout\nDisallow: /\n\nUser-agent: *\nAllow: /")
        .allowed,
    ).toBe(false);
    expect(policy("User-agent: *\nCrawl-delay: 10").delayMs).toBe(10000);
    expect(() => policy("<html>temporary error</html>")).toThrow(/HTML/);
  });
  it("has dated concrete access routes for every source, without blanket AI labels", () => {
    const config = JSON.parse(readFileSync("config/sources.json", "utf8"));
    for (const s of config) {
      expect(s.access.method).toBeTruthy();
      expect(Date.parse(s.access.checkedAt)).toBeGreaterThan(0);
      expect(s.access.nextStep).toBeTruthy();
      expect(s.access.evidenceUrls.length).toBeGreaterThan(0);
      expect(s.note).not.toMatch(/AI agents.*blocked|AI crawling restricted/);
    }
  });
});
describe("JWS catalog", () => {
  const source = sources.find((s) => s.id === "jws")!;
  const context = {
    url: source.inventory![0],
    observedAt: "2026-09-12T21:00:00Z",
    lastNetworkCheckedAt: "2026-09-12T21:00:00Z",
    hash: "fixture",
    scope: "regional" as const,
  };
  const card = (id: string, title: string) =>
    `<a href="http://www.jwsclassics.com/detail/?id=${id}"><div class="imagecar" style="background-image: url(http://www.jwsclassics.com/img-primary/sample.jpg)">${title}</div></a>`;
  const html = `<section><h2>Current Inventory</h2>${card("100", "1967 Ford Mustang")}${card("101", "2016 Ford Mustang GT")}</section><section><h2>Recently Sold</h2>${card("102", "1968 Chevy Camaro Z/28")}</section>`;
  it("uses section-level availability, safe HTTPS IDs and unknown asks", () => {
    const result = parseInventory(html, source, context);
    expect(result.discovered).toBe(3);
    expect(result.listings).toHaveLength(2);
    expect(result.listings.map((l) => l.availability)).toEqual([
      "active",
      "sold",
    ]);
    expect(result.listings[0].url).toBe(
      "https://www.jwsclassics.com/detail/?id=100",
    );
    expect(result.listings.every((l) => l.askingPrice === null)).toBe(true);
    expect(result.listings[0].photos[0]).toMatch(/^https:/);
  });
  it("rejects layout loss instead of inventing zero inventory", () => {
    expect(() =>
      parseInventory("<h1>Current Inventory</h1>", source, context),
    ).toThrow(/sections/);
  });
  it("rejects foreign card origins and unrelated footer links", () => {
    expect(() =>
      parseInventory(
        html.replaceAll("www.jwsclassics.com/detail", "other.example/detail"),
        source,
        context,
      ),
    ).toThrow(/zero stock/);
  });
});

import { sourceFeedTemplate } from "../server/ingest/feed-template";
import { parseAuthorizedFeed } from "../server/ingest/authorized-feed";
it("creates a private setup template for every source without granting authorization", () => {
  for (const source of sources) {
    const template = sourceFeedTemplate(
      source,
      new Date("2026-09-12T00:00:00Z"),
    );
    expect(template.manifest.sourceId).toBe(source.id);
    expect(template.manifest.authorization.publicRedistribution).toBe(false);
    expect(template.manifest.pagination.terminal).toBe(false);
    expect(() => parseAuthorizedFeed(template)).toThrow();
  }
});
