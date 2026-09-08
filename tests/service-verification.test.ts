import { describe, expect, it, vi } from "vitest";
import { verifyRouting, decodeRouteGeometry } from "../scripts/verify-routing";
import {
  verifyDelivery,
  acceptanceDigestId,
  deliveryReadiness,
} from "../scripts/verify-delivery";

type DeliveryRuntime = Awaited<
  ReturnType<NonNullable<Parameters<typeof verifyDelivery>[1]>>
>;
type RoutingRuntime = Awaited<
  ReturnType<NonNullable<Parameters<typeof verifyRouting>[1]>>
>;
const webhookEnv = {
  MUSCLESCOUT_WEBHOOK_URL: "https://example.org/synthetic-test",
};
function deliveryRuntime(enabled = true) {
  const receipts = new Map<string, any>();
  const runtime = {
    getSettings: vi.fn(async () => ({
      webhookEnabled: enabled,
      emailEnabled: enabled,
    })),
    acquireLease: vi.fn(async () => ({
      renew: vi.fn(async () => undefined),
      release: vi.fn(async () => undefined),
    })),
    reserve: vi.fn(async () => undefined),
    request: vi.fn(async () => ({ status: 204, body: "", headers: {} })),
    readReceipt: vi.fn(async (id: string) => receipts.get(id) || null),
    writeReceipt: vi.fn(async (receipt: any) => {
      receipts.set(receipt.id, receipt);
    }),
    sendEmail: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
  };
  return {
    runtime,
    receipts,
    load: async () => runtime as unknown as DeliveryRuntime,
  };
}
describe("bounded provider validation", () => {
  it("makes zero runtime loads and zero requests when ORS is missing", async () => {
    const load = vi.fn();
    expect(await verifyRouting({ live: true, env: {} }, load)).toMatchObject({
      status: "blocked",
      requestOperations: 0,
    });
    expect(load).not.toHaveBeenCalled();
  });
  it("requires explicit live opt-in even when an ORS key is present", async () => {
    const load = vi.fn();
    expect(
      await verifyRouting(
        { env: { MUSCLESCOUT_ORS_KEY: "synthetic-key" } },
        load,
      ),
    ).toMatchObject({ status: "ready", requestOperations: 0 });
    expect(load).not.toHaveBeenCalled();
  });
  it("decodes bounded provider geometry and rejects malformed input", () => {
    expect(decodeRouteGeometry("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
    expect(() => decodeRouteGeometry("_")).toThrow(/Truncated/);
    expect(() => decodeRouteGeometry("\u0000?")).toThrow(/Invalid/);
  });
  it("checks two specified legs with at most five requests and preserves non-traffic provenance", async () => {
    const cities: string[] = [];
    const request = vi.fn(async (url: string, options: any) => {
      expect(options.redirects).toBe(3);
      return {
        status: 200,
        body: url.includes("openrouteservice")
          ? JSON.stringify({
              routes: [
                {
                  summary: { duration: 7231, distance: 141231 },
                  geometry: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
                },
              ],
            })
          : "[]",
        headers: {},
      };
    });
    const runtime = {
      getSettings: async () => ({
        home: {
          city: "Wheaton",
          state: "IL",
          country: "US",
          precision: "unknown",
          offsite: false,
        },
        routeMaxAgeDays: 30,
      }),
      acquireLease: async () => ({
        renew: async () => undefined,
        release: async () => undefined,
      }),
      geocodeLocation: async (location: any, options: any) => {
        cities.push(location.city);
        expect(options.force).toBe(true);
        await options.request("https://nominatim.openstreetmap.org/search");
        return {
          ...location,
          lat: 41.85,
          lon: -88.1,
          precision: "city",
          evidence: {
            validatedAddress: true,
            countryCode: "us",
            state: location.state,
          },
          provider: "Nominatim",
        };
      },
      route: async (_origin: any, _destination: any, options: any) => {
        expect(options.maxAgeDays).toBe(0);
        await options.request(
          "https://api.openrouteservice.org/v2/directions/driving-car/json",
          {
            method: "POST",
            body: JSON.stringify({
              coordinates: [
                [-88.1, 41.85],
                [-86.1, 42.78],
              ],
              options: { avoid_features: ["ferries"], avoid_borders: "all" },
            }),
          },
        );
        return {
          minutes: 120.52,
          miles: 87.76,
          provider: "openrouteservice",
          traffic: false,
          observedAt: new Date().toISOString(),
          options: JSON.stringify({
            avoid_features: ["ferries"],
            avoid_borders: "all",
          }),
        };
      },
      request,
      disconnect: vi.fn(async () => undefined),
    };
    const result = await verifyRouting(
      { live: true, fresh: true, env: { MUSCLESCOUT_ORS_KEY: "synthetic" } },
      async () => runtime as unknown as RoutingRuntime,
    );
    expect(result).toMatchObject({
      status: "passed-provider-checks",
      requestOperations: 5,
      originalVehicleAdsChanged: 0,
      homeSettingsChanged: false,
    });
    expect(cities).toEqual(["Wheaton", "Milwaukee", "Holland"]);
    expect(request).toHaveBeenCalledTimes(5);
    expect(JSON.stringify(result)).not.toContain("synthetic");
    expect((result.routes as any[])[1]).toMatchObject({
      servedFromCache: false,
      geographyReview: { visualDetourReviewRequired: true },
    });
  });
  it("stops before routing unvalidated city coordinates", async () => {
    const route = vi.fn();
    const runtime = {
      getSettings: async () => ({
        home: { city: "Wheaton", state: "IL" },
        routeMaxAgeDays: 30,
      }),
      acquireLease: async () => ({
        renew: async () => undefined,
        release: async () => undefined,
      }),
      geocodeLocation: async () => ({
        lat: 1,
        lon: 2,
        country: "US",
        precision: "city",
        evidence: { validatedAddress: false },
      }),
      route,
      disconnect: async () => undefined,
    };
    expect(
      await verifyRouting(
        { live: true, env: { MUSCLESCOUT_ORS_KEY: "synthetic" } },
        async () => runtime as unknown as RoutingRuntime,
      ),
    ).toMatchObject({ status: "blocked", requestOperations: 0 });
    expect(route).not.toHaveBeenCalled();
  });
});
describe("synthetic delivery acceptance", () => {
  it("does not load runtime or call a transport when destination is missing", async () => {
    const load = vi.fn();
    expect(
      await verifyDelivery(
        { channel: "webhook", sendTest: true, env: {} },
        load,
      ),
    ).toMatchObject({ status: "blocked", sendOperations: 0 });
    expect(load).not.toHaveBeenCalled();
  });
  it("requires exactly one named channel and one plain email recipient", () => {
    expect(deliveryReadiness(webhookEnv, undefined).status).toBe("blocked");
    expect(
      deliveryReadiness(
        {
          MUSCLESCOUT_EMAIL_TO: "a@example.org,b@example.org",
          MUSCLESCOUT_SMTP_URL: "smtps://mail.example.org",
        },
        "email",
      ).status,
    ).toBe("blocked");
    expect(
      deliveryReadiness(
        { MUSCLESCOUT_WEBHOOK_URL: "http://example.org/hook" },
        "webhook",
      ).status,
    ).toBe("blocked");
  });
  it("defaults to read-only readiness without lease, receipt, budget or send operations", async () => {
    const { runtime, load } = deliveryRuntime();
    expect(
      await verifyDelivery({ channel: "webhook", env: webhookEnv }, load),
    ).toMatchObject({
      status: "ready",
      mode: "check-only",
      sendOperations: 0,
      queuedAlertsRead: 0,
    });
    for (const fn of [
      runtime.request,
      runtime.sendEmail,
      runtime.acquireLease,
      runtime.reserve,
      runtime.readReceipt,
      runtime.writeReceipt,
    ])
      expect(fn).not.toHaveBeenCalled();
  });
  it("refuses sending when application settings have not opted in", async () => {
    const { runtime, load } = deliveryRuntime(false);
    expect(
      await verifyDelivery(
        { channel: "webhook", sendTest: true, env: webhookEnv },
        load,
      ),
    ).toMatchObject({ status: "blocked", sendOperations: 0 });
    expect(runtime.request).not.toHaveBeenCalled();
    expect(runtime.reserve).not.toHaveBeenCalled();
  });
  it("honors consent revoked while waiting for the service reservation", async () => {
    const { runtime, load } = deliveryRuntime();
    runtime.reserve.mockImplementation(async () => {
      runtime.getSettings.mockResolvedValue({
        webhookEnabled: false,
        emailEnabled: false,
      });
    });
    expect(
      await verifyDelivery(
        { channel: "webhook", sendTest: true, env: webhookEnv },
        load,
      ),
    ).toMatchObject({ status: "blocked", sendOperations: 0 });
    expect(runtime.request).not.toHaveBeenCalled();
    expect(runtime.writeReceipt).not.toHaveBeenCalled();
  });
  it("sends exactly one synthetic digest and suppresses repeats using the same stable receipt", async () => {
    const { runtime, load } = deliveryRuntime();
    const options = { channel: "webhook", sendTest: true, env: webhookEnv };
    const result = await verifyDelivery(options, load);
    expect(result).toMatchObject({
      status: "accepted-by-transport",
      sendOperations: 1,
      queuedAlertsRead: 0,
      automaticRetriesScheduled: 0,
    });
    expect(runtime.request).toHaveBeenCalledTimes(1);
    const [url, requestOptions] = runtime.request.mock.calls[0] as unknown as [
      string,
      any,
    ];
    expect(url).toBe(webhookEnv.MUSCLESCOUT_WEBHOOK_URL);
    const payload = JSON.parse(requestOptions.body);
    expect(payload).toMatchObject({
      synthetic: true,
      id: acceptanceDigestId("webhook", url),
    });
    expect(payload.alerts).toHaveLength(1);
    expect(requestOptions.headers["Idempotency-Key"]).toBe(payload.id);
    expect(runtime.reserve).toHaveBeenCalledWith("https://example.org", {
      minIntervalMs: 1000,
      dailyLimit: 100,
      maxWaitMs: 10000,
    });
    expect(await verifyDelivery(options, load)).toMatchObject({
      status: "already-accepted-by-transport",
      sendOperations: 0,
    });
    expect(runtime.request).toHaveBeenCalledTimes(1);
  });
  it("requires explicit retry and uncertainty acknowledgement without automatically resending", async () => {
    const { runtime, receipts, load } = deliveryRuntime();
    const id = acceptanceDigestId(
      "webhook",
      webhookEnv.MUSCLESCOUT_WEBHOOK_URL,
    );
    receipts.set(id, {
      id,
      channel: "webhook",
      createdAt: new Date().toISOString(),
      status: "sending",
      attempts: 1,
    });
    expect(
      await verifyDelivery(
        {
          channel: "webhook",
          sendTest: true,
          retryTest: true,
          env: webhookEnv,
        },
        load,
      ),
    ).toMatchObject({ status: "blocked", sendOperations: 0 });
    expect(receipts.get(id).status).toBe("uncertain");
    expect(runtime.request).not.toHaveBeenCalled();
  });
  it("records timeout uncertainty and never schedules automatic retry", async () => {
    const { runtime, load } = deliveryRuntime();
    runtime.request.mockRejectedValueOnce(
      new Error("Source request timed out."),
    );
    expect(
      await verifyDelivery(
        { channel: "webhook", sendTest: true, env: webhookEnv },
        load,
      ),
    ).toMatchObject({
      status: "uncertain",
      sendOperations: 1,
      automaticRetriesScheduled: 0,
    });
    expect(runtime.request).toHaveBeenCalledTimes(1);
  });
  it("keeps a transport success uncertain if the success receipt cannot be persisted", async () => {
    const { runtime, load } = deliveryRuntime();
    runtime.writeReceipt.mockImplementation(async (receipt) => {
      if (receipt.status !== "sending") throw new Error("disk unavailable");
    });
    expect(
      await verifyDelivery(
        { channel: "webhook", sendTest: true, env: webhookEnv },
        load,
      ),
    ).toMatchObject({
      status: "uncertain",
      receiptRecorded: false,
      sendOperations: 1,
      automaticRetriesScheduled: 0,
    });
    expect(runtime.request).toHaveBeenCalledTimes(1);
  });
  it("records a failed SMTP test with shared permanent-rejection semantics", async () => {
    const { runtime, load } = deliveryRuntime();
    runtime.sendEmail.mockRejectedValueOnce(
      Object.assign(new Error("private SMTP detail"), { code: "EAUTH" }),
    );
    const result = await verifyDelivery(
      {
        channel: "email",
        sendTest: true,
        env: {
          MUSCLESCOUT_SMTP_URL: "smtps://mail.example.org",
          MUSCLESCOUT_EMAIL_TO: "test@example.org",
        },
      },
      load,
    );
    expect(result).toMatchObject({
      status: "failed",
      sendOperations: 1,
      automaticRetriesScheduled: 0,
    });
    expect(JSON.stringify(result)).not.toContain("private SMTP detail");
    expect(runtime.request).not.toHaveBeenCalled();
    expect(runtime.sendEmail).toHaveBeenCalledTimes(1);
  });
});
