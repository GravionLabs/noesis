import type { FastifyInstance } from "fastify";
import { validate as isUuid } from "uuid";
import type { ChunkService } from "../services/chunk-service.js";
import type { SourceService } from "../services/source-service.js";

export function registerDocRoutes(
  app: FastifyInstance,
  deps: { chunkService: ChunkService; sourceService: SourceService },
) {
  app.get<{ Params: { id: string } }>(
    "/api/sources/:id/docs",
    async (req, reply) => {
      const { id } = req.params;

      if (!isUuid(id)) {
        return reply.code(400).send({ error: "Invalid source ID" });
      }

      const source = await deps.sourceService.getSource(id);
      if (!source) {
        return reply.code(404).send({ error: "Source not found" });
      }

      const docs = await deps.chunkService.listDocsBySourceId(id);
      return docs;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/docs/:id/chunks",
    async (req, reply) => {
      const { id } = req.params;

      if (!isUuid(id)) {
        return reply.code(400).send({ error: "Invalid doc ID" });
      }

      const chunks = await deps.chunkService.getChunksByDocId(id);
      if (chunks.length === 0) {
        return reply.code(404).send({ error: "Doc not found or has no chunks" });
      }

      return chunks;
    },
  );
}
