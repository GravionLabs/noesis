import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  listSources,
  createSource,
  getSource,
  updateSource,
  deleteSource,
  getSourceStats,
} from "../services/source-service.js";
import { triggerImport } from "../services/import-service.js";
import { isValidCron, scheduleNextRun } from "../pipeline/scheduler.js";

const createSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  importerType: z.string().optional(),
  config: z.string().optional(),
  schedule: z.string().optional().refine(
    (val) => !val || isValidCron(val),
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

const listSourcesSchema = {
  tags: ["Sources"],
  response: {
    200: {
      type: "array",
      items: sourceObject,
    },
  },
};

const createSourceRouteSchema = {
  tags: ["Sources"],
  body: {
    type: "object",
    properties: {
      name: { type: "string" },
      url: { type: "string", format: "uri" },
      importerType: { type: "string" },
      config: { type: "string" },
      schedule: { type: "string" },
    },
    required: ["name", "url"],
  },
  response: {
    201: sourceObject,
    400: {
      type: "object",
      properties: {
        error: { type: "string" },
        details: { type: "array" },
      },
    },
    409: {
      type: "object",
      properties: { error: { type: "string" } },
    },
  },
};

const getSourceSchema = {
  tags: ["Sources"],
  params: {
    type: "object",
    properties: { id: { type: "string", format: "uuid" } },
    required: ["id"],
  },
  response: {
    200: sourceObject,
    404: {
      type: "object",
      properties: { error: { type: "string" } },
    },
  },
};

const updateSourceSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  importerType: z.string().optional(),
  enabled: z.boolean().optional(),
  config: z.string().nullable().optional(),
  schedule: z.string().nullable().optional().refine(
    (val) => val === undefined || val === null || isValidCron(val),
    { message: "Invalid cron expression" },
  ),
});

const updateSourceRouteSchema = {
  tags: ["Sources"],
  params: {
    type: "object",
    properties: { id: { type: "string", format: "uuid" } },
    required: ["id"],
  },
  body: {
    type: "object",
    properties: {
      name: { type: "string" },
      url: { type: "string", format: "uri" },
      importerType: { type: "string" },
      enabled: { type: "boolean" },
      config: { type: "string", nullable: true },
      schedule: { type: "string", nullable: true },
    },
  },
  response: {
    200: sourceObject,
    400: {
      type: "object",
      properties: {
        error: { type: "string" },
        details: { type: "array" },
      },
    },
    404: {
      type: "object",
      properties: { error: { type: "string" } },
    },
  },
};

const deleteSourceSchema = {
  tags: ["Sources"],
  params: {
    type: "object",
    properties: { id: { type: "string", format: "uuid" } },
    required: ["id"],
  },
  response: {
    204: { type: "null" },
    404: {
      type: "object",
      properties: { error: { type: "string" } },
    },
  },
};

const sourceStatsObject = {
  type: "object",
  properties: {
    docCount: { type: "integer" },
    chunkCount: { type: "integer" },
    avgTokenCount: { type: "integer", nullable: true },
    latestJobStatus: { type: "string", nullable: true },
    latestJobDurationMs: { type: "integer", nullable: true },
  },
};

const sourceStatsSchema = {
  tags: ["Sources"],
  params: {
    type: "object",
    properties: { id: { type: "string", format: "uuid" } },
    required: ["id"],
  },
  response: {
    200: sourceStatsObject,
    404: {
      type: "object",
      properties: { error: { type: "string" } },
    },
  },
};

const importSourceSchema = {
  tags: ["Sources"],
  params: {
    type: "object",
    properties: { id: { type: "string", format: "uuid" } },
    required: ["id"],
  },
  response: {
    202: {
      type: "object",
      properties: {
        jobId: { type: "string", format: "uuid" },
        status: { type: "string" },
      },
    },
    404: {
      type: "object",
      properties: { error: { type: "string" } },
    },
  },
};

export function registerSourceRoutes(app: FastifyInstance) {
  app.get("/api/sources", { schema: listSourcesSchema }, async (_req, reply) => {
    const sources = await listSources();
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

  app.post("/api/sources", { schema: createSourceRouteSchema }, async (req, reply) => {
    const parsed = createSourceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Validation failed", details: parsed.error.issues });
    }

    const source = await createSource(parsed.data);
    if (!source) {
      return reply.code(409).send({ error: "Source with this URL already exists" });
    }
    if (source.schedule) {
      scheduleNextRun(source);
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
    { schema: getSourceSchema },
    async (req, reply) => {
      const source = await getSource(req.params.id);
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
    { schema: updateSourceRouteSchema },
    async (req, reply) => {
      const parsed = updateSourceSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Validation failed", details: parsed.error.issues });
      }

      const source = await updateSource(req.params.id, parsed.data);
      if (!source) return reply.code(404).send({ error: "Source not found" });

      if (parsed.data.schedule !== undefined) {
        scheduleNextRun(source);
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
    { schema: deleteSourceSchema },
    async (req, reply) => {
      const deleted = await deleteSource(req.params.id);
      if (!deleted) return reply.code(404).send({ error: "Source not found" });
      return reply.code(204).send();
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/sources/:id/stats",
    { schema: sourceStatsSchema },
    async (req, reply) => {
      const source = await getSource(req.params.id);
      if (!source) return reply.code(404).send({ error: "Source not found" });

      const stats = await getSourceStats(req.params.id);
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
    { schema: importSourceSchema },
    async (req, reply) => {
      try {
        const job = await triggerImport(req.params.id);
        return reply.code(202).send({ jobId: job.id, status: "accepted" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.code(404).send({ error: message });
      }
    },
  );
}
