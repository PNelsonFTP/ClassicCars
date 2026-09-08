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
import { searchListings, potentialDuplicates } from "../shared/search";
import {
  searchSchema,
  workspaceSchema,
  settingsSchema,
  listingSchema,
  locationSchema,
} from "../shared/schema";
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
  await app.register(rateLimit, { max: 180, timeWindow: "1 minute" });
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
    const { id } = z.object({ id: z.string() }).parse(req.params),
      location = locationSchema.parse(req.body);
    const row = await db.listing.findUniqueOrThrow({ where: { id } }),
      l = listingSchema.parse(JSON.parse(row.payload));
    l.vehicleLocation = location;
    l.userOverrides = {
      ...l.userOverrides,
      vehicleLocation: location,
      reviewedAt: new Date().toISOString(),
    };
    l.route = null;
    l.straightLineMiles = null;
    l.flags.push("Location corrected by user; routing refresh required.");
    await db.listing.update({
      where: { id },
      data: {
        payload: JSON.stringify(l),
        driveMinutes: null,
        vehicleState: location.state,
      },
    });
    return l;
  });
  app.patch("/api/listings/:id/review", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const patch = z
      .object({
        year: z.number().int().min(1885).max(2100).nullable(),
        specialtyEvidence: z.enum([
          "unknown",
          "seller-claimed",
          "document-supported",
          "user-reviewed",
        ]),
        vehicleLocation: locationSchema.nullable(),
        reason: z.string().min(5).max(5000),
      })
      .parse(req.body);
    const row = await db.listing.findUniqueOrThrow({ where: { id } });
    const old = listingSchema.parse(JSON.parse(row.payload));
    const updated = {
      ...old,
      userOverrides: {
        year: patch.year,
        specialtyEvidence: patch.specialtyEvidence,
        vehicleLocation: patch.vehicleLocation,
        identityStatus: patch.year
          ? ("consistent" as const)
          : ("review" as const),
        reviewedAt: new Date().toISOString(),
      },
      year: patch.year,
      specialtyEvidence: patch.specialtyEvidence,
      vehicleLocation: patch.vehicleLocation,
      identityStatus: patch.year
        ? ("consistent" as const)
        : ("review" as const),
      identityNotes: [
        ...old.identityNotes,
        `User-reviewed correction: ${patch.reason}`,
      ],
      route: null,
      straightLineMiles: null,
    };
    await db.$transaction(async (tx) => {
      await tx.listing.update({
        where: { id },
        data: {
          year: updated.year,
          vehicleState: updated.vehicleLocation?.state,
          driveMinutes: null,
          payload: JSON.stringify(updated),
        },
      });
      await tx.observation.create({
        data: {
          listingId: id,
          kind: "user-correction",
          observedAt: new Date(),
          payload: JSON.stringify({
            previous: {
              year: old.year,
              location: old.vehicleLocation,
              specialtyEvidence: old.specialtyEvidence,
            },
            patch,
          }),
        },
      });
    });
    return updated;
  });
  app.get("/api/groups/review", async () =>
    potentialDuplicates(await allListings()),
  );
  app.post("/api/groups/merge", async (req) => {
    const { ids, reason } = z
      .object({
        ids: z.array(z.string()).min(2).max(20),
        reason: z.string().min(3),
      })
      .parse(req.body);
    const listings = await db.listing.findMany({ where: { id: { in: ids } } });
    if (listings.length !== ids.length)
      throw new Error("Unknown listing in merge");
    const id = `reviewed:${randomUUID()}`;
    await db.$transaction(async (tx) => {
      await tx.groupReview.create({
        data: {
          id,
          listingIds: JSON.stringify(
            listings.map((l) => ({ id: l.id, groupId: l.groupId })),
          ),
          action: "merge",
          reason,
        },
      });
      for (const row of listings)
        await tx.listing.update({
          where: { id: row.id },
          data: {
            groupId: id,
            payload: JSON.stringify({
              ...JSON.parse(row.payload),
              groupId: id,
            }),
          },
        });
    });
    return { groupId: id };
  });
  app.post("/api/groups/unmerge", async (req) => {
    const { groupId } = z.object({ groupId: z.string() }).parse(req.body),
      review = await db.groupReview.findUniqueOrThrow({
        where: { id: groupId },
      });
    await db.$transaction(async (tx) => {
      for (const entry of JSON.parse(review.listingIds)) {
        const row = await tx.listing.findUniqueOrThrow({
          where: { id: entry.id },
        });
        await tx.listing.update({
          where: { id: entry.id },
          data: {
            groupId: entry.groupId,
            payload: JSON.stringify({
              ...JSON.parse(row.payload),
              groupId: entry.groupId,
            }),
          },
        });
      }
      await tx.groupReview.update({
        where: { id: groupId },
        data: { action: "unmerged" },
      });
    });
    return { ok: true };
  });
  app.post("/api/collect", async (req) => {
    const body = z
      .object({ scope: z.enum(["regional", "nationwide"]).default("regional") })
      .parse(req.body);
    await db.setting.upsert({
      where: { key: "collection-request" },
      create: {
        key: "collection-request",
        value: JSON.stringify({
          scope: body.scope,
          requestedAt: new Date().toISOString(),
        }),
      },
      update: {
        value: JSON.stringify({
          scope: body.scope,
          requestedAt: new Date().toISOString(),
        }),
      },
    });
    return { status: "queued", scope: body.scope };
  });
  app.post("/api/collection/expand", async () => {
    const s = await getSettings();
    s.nationwideEnabled = true;
    await db.setting.upsert({
      where: { key: "settings" },
      create: { key: "settings", value: JSON.stringify(s) },
      update: { value: JSON.stringify(s) },
    });
    await db.setting.upsert({
      where: { key: "collection-request" },
      create: {
        key: "collection-request",
        value: JSON.stringify({ scope: "nationwide" }),
      },
      update: { value: JSON.stringify({ scope: "nationwide" }) },
    });
    return { status: "queued", scope: "nationwide" };
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
