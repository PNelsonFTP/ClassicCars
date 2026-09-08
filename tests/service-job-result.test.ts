import { describe, expect, it } from "vitest";
import { serviceJobCompletion } from "../server/ingest/job-result";
describe("provider results in durable jobs", () => {
  it("keeps missing credentials as a visible partial result without automatic requests", () => {
    expect(
      serviceJobCompletion({
        processed: 0,
        reason: "ORS key is not configured",
      }),
    ).toMatchObject({ state: "partial", nextRunAt: null });
  });
  it("keeps quota/network failures and review items partial even if some items succeeded", () => {
    expect(
      serviceJobCompletion({
        processed: 2,
        remaining: 3,
        errors: [{ message: "Daily budget reached" }],
      }).state,
    ).toBe("partial");
    expect(
      serviceJobCompletion({ processed: 2, remaining: 0, reviewNeeded: 1 })
        .state,
    ).toBe("partial");
  });
  it("does not auto-continue a bounded explicit service job just because more items remain", () => {
    expect(
      serviceJobCompletion({ processed: 10, remaining: 50, errors: [] }),
    ).toMatchObject({ state: "partial", nextRunAt: null });
  });
  it("retains an interrupted explicit job for shutdown recovery", () => {
    expect(
      serviceJobCompletion(
        { processed: 1, remaining: 2 },
        true,
        Date.parse("2026-09-08T12:00:00Z"),
      ),
    ).toMatchObject({
      state: "interrupted",
      nextRunAt: "2026-09-08T12:00:10.000Z",
    });
  });
  it("marks completion only when the returned result has no pending or failed work", () => {
    expect(
      serviceJobCompletion({ processed: 10, remaining: 0, errors: [] }).state,
    ).toBe("completed");
    expect(serviceJobCompletion(null).state).toBe("partial");
  });
});
