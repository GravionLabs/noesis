import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { SourceService } from "../services/source-service.js";
import type { ImportService } from "../services/import-service.js";
import type { Scheduler } from "../pipeline/scheduler.js";
import type { ChunkService } from "../services/chunk-service.js";

const createSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  importerType: z.string().optional(),
  config: z.string().optional(),
  schedule: z.string().optional().refine(
    (val) => !val || true,
    { message: "Invalid cron expression" },
  ),
});

const updateSourceSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  importerType: z.string().optional(),
  enabled: z.boolean().optional(),
  config: z.string().nullable().optional(),
  schedule: z.string().nullable().optional().refine(
    (val) => val === undefined || val === null || true,
    { message: "Invalid cron expression" },
  ),
});

const sourceObject = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    name: { type: "string" },
    url: { type: "string" },
    importerType: { type: "string" },
    enabled: { type: "boolean" },
    config: { type: "string", nullable: true },
    schedule: { type: "string", nullable: true },
    lastImportedAt: { type: "string", format: "date-time", nullable: true },
  },
};

export function registerSourceRoutes(
  app: FastifyInstance,
  deps: { sourceService: SourceService; importService: ImportService; scheduler: Scheduler; chunkService: ChunkService },
) {
  const { sourceService, importService, scheduler, chunkService } = deps;

  app.get("/api/sources", async (_req, reply) => {
    const sources = await sourceService.listSources();
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      importerType: s.importerType,
      enabled: s.enabled,
      config: s.config,
      schedule: s.schedule,
      lastImportedAt: s.lastImportedAt,
    }));
  });

  app.post("/api/sources", async (req, reply) => {
    const parsed = createSourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Validation failed", details: parsed.error.issues });
    }

    if (parsed.data.schedule && !scheduler.isValidCron(parsed.data.schedule)) {
      return reply.code(400).send({ error: "Invalid cron expression" });
    }

    const source = await sourceService.createSource(parsed.data);
    if (!source) {
      return reply.code(409).send({ error: "Source with this URL already exists" });
    }
    if (source.schedule) {
      scheduler.scheduleNextRun(source);
    }
    return reply.code(201).send({
      id: source.id,
      name: source.name,
      url: source.url,
      importerType: source.importerType,
      enabled: source.enabled,
      config: source.config,
      schedule: source.schedule,
      lastImportedAt: source.lastImportedAt,
    });
  });

  app.get<{ Params: { id: string } }>(
    "/api/sources/:id",
    async (req, reply) => {
      const source = await sourceService.getSource(req.params.id);
      if (!source) return reply.code(404).send({ error: "Source not found" });
      return {
        id: source.id,
        name: source.name,
        url: source.url,
        importerType: source.importerType,
        enabled: source.enabled,
        config: source.config,
        schedule: source.schedule,
        lastImportedAt: source.lastImportedAt,
      };
    },
  );

  app.patch<{ Params: { id: string } }>(
    "/api/sources/:id",
    async (req, reply) => {
      const parsed = updateSourceSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Validation failed", details: parsed.error.issues });
      }

      if (parsed.data.schedule !== undefined && parsed.data.schedule !== null && !scheduler.isValidCron(parsed.data.schedule)) {
        return reply.code(400).send({ error: "Invalid cron expression" });
      }

      const source = await sourceService.updateSource(req.params.id, parsed.data);
      if (!source) return reply.code(404).send({ error: "Source not found" });

      if (parsed.data.schedule !== undefined) {
        scheduler.scheduleNextRun(source);
      }
      return {
        id: source.id,
        name: source.name,
        url: source.url,
        importerType: source.importerType,
        enabled: source.enabled,
        config: source.config,
        schedule: source.schedule,
        lastImportedAt: source.lastImportedAt,
      };
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/sources/:id",
    async (req, reply) => {
      const deleted = await sourceService.deleteSource(req.params.id);
      if (!deleted) return reply.code(404).send({ error: "Source not found" });
      scheduler.unschedule(req.params.id);
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/sources/:id/stats",
    async (req, reply) => {
      const source = await sourceService.getSource(req.params.id);
      if (!source) return reply.code(404).send({ error: "Source not found" });

      const stats = await sourceService.getSourceStats(req.params.id);
      return {
        docCount: stats.docCount,
        chunkCount: stats.chunkCount,
        avgTokenCount: stats.avgTokenCount,
        latestJobStatus: stats.latestJobStatus,
        latestJobDurationMs: stats.latestJobDurationMs,
      };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/sources/:id/import",
    async (req, reply) => {
      try {
        const job: any = await importService.triggerImport(req.params.id);
        return reply.code(202).send({ jobId: job.id, status: "accepted" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.code(404).send({ error: message });
      }
    },
  );

  /**
   * POST /api/sources/:id/backfill
   *
   * Purges existing chunks for this source that are classified as link-list
   * noise by the same predicate applied at ingestion time. Embeddings are
   * cascade-deleted. Idempotent — calling twice on an already-clean source
   * returns { purged: 0 }.
   */
  app.post<{ Params: { id: string } }>(
    "/api/sources/:id/backfill",
    async (req, reply) => {
      const source = await sourceService.getSource(req.params.id);
      if (!source) return reply.code(404).send({ error: "Source not found" });

      const result = await chunkService.purgeNoisyChunks(req.params.id);
      return reply.code(200).send(result);
    },
  );
}
