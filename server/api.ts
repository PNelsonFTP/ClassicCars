import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  randomUUID,
} from "node:crypto";
import { db } from "./db";
import {
  allListings,
  getWorkspace,
  getSettings,
  saveSettings,
  upsertListing,
  snapshot,
} from "./store";
import { searchListings } from "../shared/search";
import {
  searchSchema,
  workspaceSchema,
  settingsSchema,
  listingSchema,
  locationSchema,
} from "../shared/schema";
import { correctListing, resetCorrection, provenance } from "./reviews";
import { registerCollectionRoutes } from "./collection-api";
import { getServiceBudgets } from "./service-budget";
import { retryGeocode } from "./geography";
import { searchPage } from "./search-page";
import {
  duplicateReviewPage,
  mergeReviewedGroups,
  unmergeReviewedGroup,
  reviewDuplicateDecision,
  saveSellerAliases,
} from "./grouping";
import { retryDelivery } from "./alerts";
export async function buildApi() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "test" ? "silent" : "info",
      redact: ["req.headers.authorization", "req.body.password"],
    },
    bodyLimit: 5e6,
  });
  const origins = (
    process.env.MUSCLESCOUT_ALLOWED_ORIGINS ||
    "http://127.0.0.1:3100,http://localhost:3100"
  )
    .split(",")
    .map((s) => s.trim());
  await app.register(cors, {
    origin: origins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  await app.register(rateLimit, {
    max: 180,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      const value = request.headers.authorization?.replace(/^Bearer /, "");
      const hash = value
        ? createHash("sha256").update(value).digest("hex")
        : "";
      return hash && (sessions.get(hash) || 0) > Date.now()
        ? `session:${hash}`
        : request.ip;
    },
  });
  const password = process.env.MUSCLESCOUT_PASSWORD;
  if (!password)
    throw new Error("Run npm run setup to generate the backend password.");
  const salt = randomBytes(16),
    passwordHash = scryptSync(password, salt, 32),
    sessions = new Map<string, number>();
  app.setErrorHandler((error, request, reply) => {
    const e = error as Error & { statusCode?: number };
    reply.code(error instanceof z.ZodError ? 400 : e.statusCode || 500).send({
      error:
        error instanceof z.ZodError
          ? error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : e.statusCode && e.statusCode < 500
            ? e.message
            : "Request failed. Check local backend logs.",
    });
    if (!(error instanceof z.ZodError))
      request.log.error({ message: e.message }, "Request failed");
  });
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Cache-Control", "no-store");
    const origin = req.headers.origin;
    if (origin && !origins.includes(origin))
      return reply.code(403).send({ error: "Origin is not allowed." });
    if (
      req.method === "OPTIONS" ||
      req.url === "/health" ||
      req.url === "/api/login"
    )
      return;
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    if (
      !token ||
      !sessions.get(createHash("sha256").update(token).digest("hex")) ||
      sessions.get(createHash("sha256").update(token).digest("hex"))! <=
        Date.now()
    )
      return reply
        .code(401)
        .send({ error: "Session expired or missing. Connect again." });
  });
  app.get("/health", () => ({
    application: "musclescout",
    status: "ok",
    schemaVersion: 1,
  }));
  app.post(
    "/api/login",
    { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = z.object({ password: z.string().max(500) }).parse(req.body);
      if (!timingSafeEqual(scryptSync(body.password, salt, 32), passwordHash))
        return reply.code(401).send({ error: "Incorrect backend password." });
      const token = randomBytes(32).toString("base64url");
      sessions.set(
        createHash("sha256").update(token).digest("hex"),
        Date.now() + 8 * 36e5,
      );
      return {
        token,
        expiresAt: new Date(Date.now() + 8 * 36e5).toISOString(),
      };
    },
  );
  app.post("/api/logout", async (req) => {
    const t = req.headers.authorization?.replace(/^Bearer /, "") || "";
    sessions.delete(createHash("sha256").update(t).digest("hex"));
    return { ok: true };
  });
  app.post("/api/search", async (req) =>
    searchListings(
      await allListings(),
      searchSchema.parse(req.body),
      (await getWorkspace()).workspace,
    ),
  );
  app.post("/api/search/page", async (req) => {
    const { filters, offset, limit } = z
      .object({
        filters: searchSchema,
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(200).default(48),
      })
      .parse(req.body);
    return searchPage(filters, offset, limit);
  });
  app.get("/api/snapshot", () => snapshot(false));
  app.get("/api/workspace", getWorkspace);
  app.put("/api/workspace", async (req, reply) => {
    const body = z
      .object({ workspace: workspaceSchema, revision: z.number().int().min(0) })
      .parse(req.body);
    return db.$transaction(async (tx) => {
      const old = await tx.workspace.findUnique({ where: { id: "personal" } });
      if ((old?.revision ?? 0) !== body.revision)
        return reply.code(409).send({
          error: "Workspace changed in another tab. Refresh before saving.",
        });
      const next = await tx.workspace.upsert({
        where: { id: "personal" },
        create: {
          id: "personal",
          payload: JSON.stringify(body.workspace),
          revision: 1,
        },
        update: {
          payload: JSON.stringify(body.workspace),
          revision: { increment: 1 },
        },
      });
      for (const s of body.workspace.searches) {
        const existing = await tx.savedSearch.findUnique({
          where: { id: s.id },
        });
        const filters = JSON.stringify(s.filters);
        await tx.savedSearch.upsert({
          where: { id: s.id },
          create: {
            id: s.id,
            name: s.name,
            filters,
            defaultsVersion: s.defaultsVersion,
            schedule: s.schedule,
            delivery: s.delivery,
            bidAlerts: s.bidAlerts,
            deadlineAlerts: s.deadlineAlerts,
          },
          update: {
            name: s.name,
            filters,
            defaultsVersion: s.defaultsVersion,
            schedule: s.schedule,
            delivery: s.delivery,
            bidAlerts: s.bidAlerts,
            deadlineAlerts: s.deadlineAlerts,
            ...(existing && existing.filters !== filters
              ? { baseline: null, evaluatedAt: null }
              : {}),
          },
        });
      }
      await tx.savedSearch.deleteMany({
        where: { id: { notIn: body.workspace.searches.map((s) => s.id) } },
      });
      return { revision: next.revision };
    });
  });
  app.get("/api/settings", getSettings);
  app.put("/api/settings", async (req) => {
    const body = z
      .object({ settings: settingsSchema, dryRun: z.boolean().default(false) })
      .parse(req.body);
    if (!body.dryRun) await saveSettings(body.settings);
    return { settings: body.settings, dryRun: body.dryRun };
  });
  app.post("/api/import", async (req) => {
    const { listings } = z
      .object({ listings: z.array(z.unknown()).max(5000) })
      .parse(req.body);
    const rejected: { index: number; reason: string }[] = [];
    let accepted = 0;
    for (const [index, l] of listings.entries()) {
      try {
        const item = listingSchema.parse(l);
        if (!["https:"].includes(new URL(item.url).protocol))
          throw new Error("Listing URL must use HTTPS.");
        await upsertListing(item);
        accepted++;
      } catch (e) {
        rejected.push({ index, reason: (e as Error).message });
      }
    }
    return { accepted, rejected };
  });
  app.get("/api/listings/:id/history", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return db.observation.findMany({
      where: { listingId: id, kind: { in: ["ask", "bid", "availability"] } },
      orderBy: { observedAt: "asc" },
    });
  });
  app.patch("/api/listings/:id/location", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        reason: z
          .string()
          .min(5)
          .default(
            "User corrected actual vehicle location through the legacy location editor.",
          ),
      })
      .passthrough()
      .parse(req.body);
    return correctListing(id, {
      vehicleLocation: locationSchema.parse(body),
      reason: body.reason,
    });
  });
  app.patch("/api/listings/:id/review", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return correctListing(id, req.body);
  });
  app.post("/api/listings/:id/review/reset", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { reason } = z
      .object({ reason: z.string().trim().min(5).max(5000) })
      .parse(req.body);
    return resetCorrection(id, reason);
  });
  app.get("/api/listings/:id/provenance", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { offset, limit } = z
      .object({
        offset: z.coerce.number().int().min(0).default(0),
        limit: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(req.query);
    return provenance(id, offset, limit);
  });
  app.get("/api/groups/review", async (req) => {
    const options = z
      .object({
        offset: z.coerce.number().int().min(0).default(0),
        limit: z.coerce.number().int().min(1).max(100).default(15),
        includeDismissed: z
          .enum(["true", "false"])
          .default("false")
          .transform((v) => v === "true"),
      })
      .parse(req.query);
    return duplicateReviewPage(await allListings(), options);
  });
  app.post("/api/groups/merge", async (req) =>
    mergeReviewedGroups(req.body as Parameters<typeof mergeReviewedGroups>[0]),
  );
  app.post("/api/groups/unmerge", async (req) => {
    const body = z
      .object({
        groupId: z.string().optional(),
        reviewId: z.string().optional(),
      })
      .refine((b) => !!(b.reviewId || b.groupId))
      .parse(req.body);
    return unmergeReviewedGroup((body.reviewId || body.groupId)!);
  });
  app.post("/api/groups/decision", async (req) =>
    reviewDuplicateDecision(
      req.body as Parameters<typeof reviewDuplicateDecision>[0],
    ),
  );
  app.put("/api/groups/aliases", async (req) =>
    saveSellerAliases(
      z.object({ aliases: z.array(z.unknown()) }).parse(req.body)
        .aliases as Parameters<typeof saveSellerAliases>[0],
    ),
  );
  app.post("/api/delivery-attempts/:id/retry", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { acknowledgeUncertain } = z
      .object({ acknowledgeUncertain: z.boolean().default(false) })
      .parse(req.body);
    return retryDelivery(id, acknowledgeUncertain);
  });
  registerCollectionRoutes(app);
  app.get("/api/service-budgets", getServiceBudgets);
  app.post("/api/listings/:id/geocode/retry", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { reason } = z
      .object({ reason: z.string().trim().min(5).max(5000) })
      .parse(req.body);
    return retryGeocode(id, reason);
  });
  app.get("/api/alerts", () =>
    db.alert.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  );
  app.get("/api/delivery-attempts", () =>
    db.deliveryAttempt.findMany({
      orderBy: { nextAttemptAt: "desc" },
      take: 100,
    }),
  );
  app.post("/api/alerts/:id/read", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return db.alert.update({ where: { id }, data: { read: true } });
  });
  return app;
}
