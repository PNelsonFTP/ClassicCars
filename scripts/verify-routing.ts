import { pathToFileURL } from "node:url";
import type { Location } from "../shared/schema";
import { writePrivateValidation } from "./verification-report";
type Env = Record<string, string | undefined>;
type Runtime = {
  getSettings: () => Promise<{ home: Location; routeMaxAgeDays: number }>;
  geocodeLocation: typeof import("../server/geography").geocodeLocation;
  route: typeof import("../server/geography").openRouteService.route;
  request: typeof import("../server/safe-fetch").safeRequest;
  acquireLease: typeof import("../server/store").acquireLease;
  disconnect: () => Promise<void>;
};
async function loadRuntime(): Promise<Runtime> {
  const [
    { getSettings, acquireLease },
    { geocodeLocation, openRouteService },
    { safeRequest },
    { db },
  ] = await Promise.all([
    import("../server/store"),
    import("../server/geography"),
    import("../server/safe-fetch"),
    import("../server/db"),
  ]);
  return {
    getSettings,
    acquireLease,
    geocodeLocation,
    route: openRouteService.route,
    request: safeRequest,
    disconnect: () => db.$disconnect(),
  };
}
export function routingReadiness(env: Env, live = false) {
  if (!env.MUSCLESCOUT_ORS_KEY?.trim())
    return {
      status: "blocked",
      reason:
        "MUSCLESCOUT_ORS_KEY is missing. No geocoder or routing request was attempted.",
      liveRequested: live,
      requestOperations: 0,
    };
  return {
    status: live ? "ready-for-live-check" : "ready",
    reason: live
      ? "A maximum of three geocoder and two ORS request operations are authorized by --live."
      : "ORS is configured. Use --live to perform the bounded service check; readiness alone sends no requests.",
    liveRequested: live,
    requestOperations: 0,
  };
}
// Standard precision-5 2D encoded polyline; ORS requests here do not request elevation.
export function decodeRouteGeometry(encoded: string): [number, number][] {
  if (encoded.length > 4e6)
    throw new Error("Route geometry exceeds diagnostic limit");
  let index = 0,
    latitude = 0,
    longitude = 0;
  const coordinates: [number, number][] = [];
  const delta = () => {
    let value = 0,
      factor = 1;
    for (let groups = 0; groups < 7; groups++) {
      if (index >= encoded.length) throw new Error("Truncated route geometry");
      const octet = encoded.charCodeAt(index++) - 63;
      if (octet < 0 || octet > 63)
        throw new Error("Invalid encoded route geometry");
      value += (octet & 31) * factor;
      if (octet < 32) return value % 2 ? -(value + 1) / 2 : value / 2;
      factor *= 32;
    }
    throw new Error("Invalid route coordinate length");
  };
  while (index < encoded.length) {
    latitude += delta();
    longitude += delta();
    if (
      Math.abs(latitude / 1e5) > 90 ||
      Math.abs(longitude / 1e5) > 180 ||
      coordinates.length >= 100000
    )
      throw new Error("Route coordinates exceed diagnostic bounds");
    coordinates.push([longitude / 1e5, latitude / 1e5]);
  }
  return coordinates;
}
export async function verifyRouting(
  options: {
    live?: boolean;
    fresh?: boolean;
    wheaton?: boolean;
    env?: Env;
  } = {},
  load: () => Promise<Runtime> = loadRuntime,
): Promise<Record<string, unknown>> {
  const readiness = routingReadiness(
    options.env || process.env,
    !!options.live,
  );
  if (readiness.status === "blocked" || !options.live) return readiness;
  let runtime: Runtime;
  try {
    runtime = await load();
  } catch {
    return {
      status: "blocked",
      reason:
        "Local runtime initialization failed before any provider request. Check setup and database configuration.",
      requestOperations: 0,
    };
  }
  const leases: NonNullable<Awaited<ReturnType<Runtime["acquireLease"]>>>[] =
    [];
  const requests: Record<string, unknown>[] = [],
    routes: Record<string, unknown>[] = [];
  let timer: ReturnType<typeof setInterval> | undefined,
    leaseLost = false;
  try {
    for (const name of ["musclescout-geocode", "musclescout-routes"]) {
      const lease = await runtime.acquireLease(name, 180);
      if (!lease)
        return {
          ...readiness,
          status: "blocked",
          reason:
            "Another geography process holds the shared lease. No diagnostic requests were sent.",
        };
      leases.push(lease);
    }
    timer = setInterval(() => {
      for (const lease of leases)
        void lease.renew().catch(() => {
          leaseLost = true;
        });
    }, 30000);
    const settings = await runtime.getSettings();
    const home = options.wheaton
      ? ({
          city: "Wheaton",
          state: "IL",
          country: "US",
          precision: "unknown",
          offsite: false,
        } as Location)
      : settings.home;
    const sourceEvidence: Record<string, unknown>[] = [];
    const request: Runtime["request"] = async (url, requestOptions = {}) => {
      if (leaseLost)
        throw new Error(
          "Shared geography lease was lost; stopped before another request",
        );
      if (requests.length >= 5)
        throw new Error("Bounded routing validation request limit reached");
      const startedAt = new Date().toISOString(),
        endpoint = new URL(url);
      const trace: Record<string, unknown> = {
        origin: endpoint.origin,
        pathname: endpoint.pathname,
        method: requestOptions.method || "GET",
        startedAt,
      };
      if (endpoint.origin === "https://api.openrouteservice.org")
        trace.body = JSON.parse(requestOptions.body || "{}");
      requests.push(trace);
      // Reject redirects rather than allowing additional uncounted requests.
      const response = await runtime.request(url, {
        ...requestOptions,
        redirects: 3,
      });
      trace.status = response.status;
      if (
        endpoint.origin === "https://api.openrouteservice.org" &&
        response.status === 200
      ) {
        const body = JSON.parse(response.body),
          route = body.routes?.[0];
        if (route)
          sourceEvidence.push({
            summary: route.summary,
            bbox: route.bbox,
            geometry: route.geometry,
            metadata: body.metadata?.attribution
              ? { attribution: body.metadata.attribution }
              : undefined,
          });
      }
      return response;
    };
    const resolve = async (location: Location) => {
      const result = await runtime.geocodeLocation(location, {
        request,
        force: !!options.fresh,
      });
      if (
        result.lat == null ||
        result.lon == null ||
        result.country !== "US" ||
        result.offsite ||
        result.precision !== "city" ||
        !result.evidence?.validatedAddress
      )
        throw new Error(
          `${location.city}, ${location.state} lacks validated country/state/city geocoder evidence; no substitute coordinates were used.`,
        );
      return result;
    };
    const origin = await resolve(home);
    for (const target of [
      { city: "Milwaukee", state: "WI" },
      { city: "Holland", state: "MI" },
    ]) {
      for (const lease of leases) await lease.renew();
      const destination = await resolve({
        ...target,
        country: "US",
        precision: "unknown",
        offsite: false,
      });
      const priorEvidence = sourceEvidence.length;
      const route = await runtime.route(origin, destination, {
        request,
        maxAgeDays: options.fresh ? 0 : settings.routeMaxAgeDays,
      });
      if (!route)
        throw new Error(
          "ORS returned no route; no estimated duration was substituted.",
        );
      const routingOptions = JSON.parse(route.options);
      if (
        route.provider !== "openrouteservice" ||
        route.traffic !== false ||
        !routingOptions.avoid_features?.includes("ferries") ||
        routingOptions.avoid_borders !== "all" ||
        !Number.isFinite(route.minutes) ||
        !Number.isFinite(route.miles) ||
        route.minutes < 0 ||
        route.miles < 0 ||
        !Number.isFinite(Date.parse(route.observedAt)) ||
        Date.parse(route.observedAt) > Date.now()
      )
        throw new Error(
          "Route provenance does not satisfy the requested ORS driving-car/non-traffic/ferry/border contract.",
        );
      const raw =
        sourceEvidence.length > priorEvidence ? sourceEvidence.at(-1) : null;
      const geometry =
        typeof raw?.geometry === "string"
          ? decodeRouteGeometry(raw.geometry)
          : null;
      routes.push({
        origin,
        destination,
        route,
        servedFromCache: sourceEvidence.length === priorEvidence,
        rawSummary: raw?.summary || null,
        bbox: raw?.bbox || null,
        geometry: geometry
          ? { type: "LineString", coordinates: geometry }
          : null,
        geographyReview:
          target.city === "Holland"
            ? {
                purpose:
                  "Review the Lake Michigan land detour in the captured provider geometry.",
                minimumObservedLatitude: geometry?.length
                  ? geometry.reduce(
                      (minimum, point) => Math.min(minimum, point[1]),
                      Infinity,
                    )
                  : null,
                visualDetourReviewRequired: true,
              }
            : null,
      });
    }
    return {
      status: "passed-provider-checks",
      requestOperations: requests.length,
      maximumRequestOperations: 5,
      originalVehicleAdsChanged: 0,
      homeSettingsChanged: false,
      attribution: "© openrouteservice by HeiGIT | Data from OpenStreetMap",
      scope:
        "Configured home city (or explicitly selected Wheaton) to Milwaukee WI and Holland MI only",
      requests,
      routes,
      remainingAcceptance: [
        "Inspect captured Holland route geometry for the Lake Michigan land detour; no expected duration was fabricated.",
        "Cached routes do not establish a fresh provider exchange. Use --live --fresh for current response evidence.",
      ],
    };
  } catch (error) {
    return {
      status: "blocked",
      reason: (error as Error).message,
      requestOperations: requests.length,
      originalVehicleAdsChanged: 0,
      homeSettingsChanged: false,
      requests,
      routes,
    };
  } finally {
    if (timer) clearInterval(timer);
    await Promise.allSettled(leases.map((lease) => lease.release()));
    await runtime.disconnect();
  }
}
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  await import("dotenv/config");
  const report = await verifyRouting({
    live: process.argv.includes("--live"),
    fresh: process.argv.includes("--fresh"),
    wheaton: process.argv.includes("--wheaton"),
  });
  const reportPath = await writePrivateValidation("routing", report);
  console.log(
    JSON.stringify(
      {
        status: report.status,
        reason: report.reason,
        requestOperations: report.requestOperations,
        reportPath,
      },
      null,
      2,
    ),
  );
}
