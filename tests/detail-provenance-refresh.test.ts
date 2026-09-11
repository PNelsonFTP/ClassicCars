import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  parseDetail,
  parseInventory,
  type SourceConfig,
} from "../server/ingest/adapters";

it("timestamps only specifications present in a fresh detail response, preserving absent evidence and input", () => {
  const source = (
    JSON.parse(readFileSync("config/sources.json", "utf8")) as SourceConfig[]
  ).find((s) => s.id === "midwest")!;
  const priorAt = "2026-09-08T02:30:00Z",
    observedAt = "2026-09-10T20:00:00Z";
  const context = {
    url: source.inventory![0],
    observedAt: priorAt,
    lastNetworkCheckedAt: priorAt,
    hash: "fixture",
    scope: "regional" as const,
  };
  const listing = parseInventory(
    readFileSync("tests/fixtures/midwest-card-3037.html", "utf8"),
    source,
    context,
  ).listings[0];
  listing.specs = {
    engineInstalled: {
      value: "Earlier advertised engine",
      basis: "seller-claimed",
      sourceUrl: listing.url,
      observedAt: priorAt,
    },
    horsepowerReported: {
      value: 365,
      basis: "document-supported",
      sourceUrl: "https://example.com/older-document",
      observedAt: priorAt,
      note: "Earlier document retained; absent from this detail response.",
    },
    axleRatio: { value: "3.70", basis: "seller-claimed" },
  };
  const before = structuredClone(listing.specs);
  const refreshed = parseDetail(
    readFileSync("tests/fixtures/midwest-detail-3037.html", "utf8"),
    listing,
    {
      ...context,
      url: listing.url,
      observedAt,
      lastNetworkCheckedAt: observedAt,
    },
  );
  expect(refreshed.specs.engineInstalled).toMatchObject({
    value: "327/365",
    sourceUrl: listing.url,
    observedAt,
  });
  expect(refreshed.specs.transmission).toMatchObject({
    value: "4 speed",
    sourceUrl: listing.url,
    observedAt,
  });
  expect(refreshed.specs.horsepowerReported).toEqual(before.horsepowerReported);
  expect(refreshed.specs.axleRatio).toEqual(before.axleRatio);
  expect(refreshed.specs.axleRatio.observedAt).toBeUndefined();
  expect(listing.specs).toEqual(before);
  expect(refreshed.lastDetailObservedAt).toBe(observedAt);
});
