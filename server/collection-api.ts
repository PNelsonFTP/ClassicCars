import { readFile } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { operations } from "./ingest/state";
import { getSettings, saveSettings } from "./store";
import type { SourceConfig } from "./ingest/adapters";
const requestSchema = z.object({
  scope: z.enum(["regional", "nationwide"]).default("regional"),
  kind: z.enum(["collection", "geocode", "routes"]).default("collection"),
  sourceId: z.string().min(1).max(80).optional(),
  pageCap: z.number().int().min(0).max(100).optional(),
  detailCap: z.number().int().min(0).max(500).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  smoke: z.boolean().default(false),
  fresh: z.boolean().default(false),
});
const sources = async () =>
  JSON.parse(await readFile("config/sources.json", "utf8")) as SourceConfig[];
/** Register behind the API's existing authentication and exact-origin hooks. */
export function registerCollectionRoutes(app: FastifyInstance) {
  const enqueue = async (raw: unknown) => {
    const body = requestSchema.parse(raw || {});
    if (
      body.sourceId &&
      !(await sources()).some((s) => s.id === body.sourceId && s.enabled)
    )
      throw new Error(
        "The requested source is unknown or disabled. A job cannot grant source access.",
      );
    if (body.kind !== "collection" && body.sourceId)
      throw new Error("Source selection applies only to collection jobs.");
    const job = await operations.enqueue(body);
    return { status: "queued", scope: job.scope, jobId: job.id, job };
  };
  app.post("/api/collect", (req) => enqueue(req.body));
  app.post("/api/jobs", (req) => enqueue(req.body));
  app.get("/api/jobs", () => operations.jobs());
  app.get("/api/jobs/:id", async (req, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params),
      job = await operations.job(id);
    return job || reply.code(404).send({ error: "Unknown collection job." });
  });
  app.post("/api/jobs/:id/cancel", (req) =>
    operations.cancel(z.object({ id: z.string().uuid() }).parse(req.params).id),
  );
  app.post("/api/jobs/:id/retry", (req) =>
    operations.retry(z.object({ id: z.string().uuid() }).parse(req.params).id),
  );
  app.get("/api/collection/progress", async (req) => {
    const query = z
      .object({ sourceId: z.string().optional() })
      .parse(req.query);
    return operations.progress(query.sourceId);
  });
  app.get("/api/source-health", () => operations.allHealth());
  app.post("/api/source-health/:sourceId/review", async (req) => {
    const { sourceId } = z
      .object({ sourceId: z.string().min(1).max(80) })
      .parse(req.params);
    const body = z
      .object({
        action: z.enum(["pause", "request-smoke"]),
        reason: z.string().trim().min(8).max(2000),
        scope: z.enum(["regional", "nationwide"]).default("regional"),
      })
      .parse(req.body);
    const source = (await sources()).find((s) => s.id === sourceId);
    if (!source || (body.action === "request-smoke" && !source.enabled))
      throw new Error(
        "A disabled or unauthorized source cannot be enabled by an operational review.",
      );
    const health = await operations.reviewSource(
      sourceId,
      body.action,
      body.reason,
    );
    if (body.action === "pause") return { health, job: null };
    await operations.reopenSourceTasks(sourceId);
    const job = await operations.enqueue({
      scope: body.scope,
      sourceId,
      smoke: true,
      pageCap: 1,
      detailCap: 1,
    });
    // Retain any server's required waiting period; reviews never circumvent Retry-After.
    if (health.nextPermittedAt)
      await operations.updateJob(job.id, (j) => ({
        ...j,
        nextRunAt: health.nextPermittedAt,
      }));
    return { health, job: await operations.job(job.id) };
  });
  app.post("/api/collection/expand", async () => {
    const settings = await getSettings();
    settings.nationwideEnabled = true;
    await saveSettings(settings);
    return enqueue({ scope: "nationwide" });
  });
}
