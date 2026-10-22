import { expect, it } from "vitest";
import { webMcpPatchSchema } from "../shared/webmcp";
import { defaultSearch, searchSchema } from "../shared/schema";
it("applies only explicit WebMCP keys and preserves independent search constraints", () => {
  const existing = {
    ...defaultSearch(),
    maxPrice: 40000,
    states: ["IL"],
    sources: ["fixture"],
    specialty: true,
    variants: ["GTD"],
    rules: [
      {
        field: "specs.transmission",
        operator: "include" as const,
        value: "manual",
      },
    ],
  };
  const patch = webMcpPatchSchema.parse({
    query: "Camero",
    mode: "unknown-route",
  });
  expect(patch).toEqual({ query: "Camero", mode: "unknown-route" });
  expect(searchSchema.parse({ ...existing, ...patch })).toMatchObject({
    maxPrice: 40000,
    states: ["IL"],
    sources: ["fixture"],
    specialty: true,
    variants: ["GTD"],
    rules: existing.rules,
  });
  expect(() => webMcpPatchSchema.parse({ mode: "invalid" })).toThrow();
  expect(() => webMcpPatchSchema.parse({ maxPrice: 0 })).toThrow();
});

it("can change approximate travel constraints without resetting the origin or other preferences", () => {
  const existing = {
    ...defaultSearch(),
    originKey: "US:WI:madison",
    originLabel: "Madison, WI",
    maxPrice: 40000,
  };
  const patch = webMcpPatchSchema.parse({
    maxMinutes: 240,
    includeBorderline: false,
    planningBuffer: "conservative",
  });
  expect(searchSchema.parse({ ...existing, ...patch })).toMatchObject({
    originKey: existing.originKey,
    originLabel: existing.originLabel,
    maxPrice: 40000,
    maxMinutes: 240,
    includeBorderline: false,
    planningBuffer: "conservative",
  });
});
