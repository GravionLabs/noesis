import type { FastifyInstance } from "fastify";
import {
  listSources,
  createSource,
  getSource,
  deleteSource,
} from "../services/source-service.js";
import { triggerImport } from "../services/import-service.js";

const createSourceSchema = {
  type: "object",
  required: ["name", "url"],
  properties: {
    name: { type: "string" },
    url: { type: "string" },
    importerType: { type: "string" },
    config: { type: "string" },
    schedule: { type: "string" },
  },
} as const;

export function registerSourceRoutes(app: FastifyInstance) {
  app.get("/api/sources", async (_req, reply) => {
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

  app.post<{ Body: { name: string; url: string; importerType?: string; config?: string; schedule?: string } }>(
    "/api/sources",
    {
      schema: { body: createSourceSchema },
    },
    async (req, reply) => {
      const source = await createSource({
        name: req.body.name,
        url: req.body.url,
        importerType: req.body.importerType,
        config: req.body.config,
        schedule: req.body.schedule,
      });
      if (!source) {
        return reply.code(409).send({ error: "Source with this URL already exists" });
      }
      return reply.code(201).send({
        id: source.id,
        name: source.name,
        url: source.url,
        importerType: source.importerType,
        enabled: source.enabled,
      });
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/api/sources/:id",
    async (req, reply) => {
      const deleted = await deleteSource(req.params.id);
      if (!deleted) return reply.code(404).send({ error: "Source not found" });
      return reply.code(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/sources/:id/import",
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
