import type { FastifyInstance } from "fastify";
import { validate as isUuid } from "uuid";
import type { ChunkService } from "../services/chunk-service.js";

interface ChunkDetail {
  id: string;
  content: string;
  heading: string | null;
  headingPath: string[];
  chunkIndex: number;
  doc: { url: string; title: string | null };
  source: { id: string; name: string; type: string };
}

export function registerChunkRoutes(
  app: FastifyInstance,
  deps: { chunkService: ChunkService },
) {
  app.get<{ Params: { id: string } }>(
    "/api/chunks/:id",
    async (req, reply) => {
      const { id } = req.params;

      if (!isUuid(id)) {
        return reply.code(400).send({ error: "Invalid chunk ID" });
      }

      const chunk = await deps.chunkService.getChunkWithSource(id);

      if (!chunk) {
        return reply.code(404).send({ error: "Chunk not found" });
      }

      const body: ChunkDetail = {
        id: chunk.chunkId,
        content: chunk.content,
        heading: chunk.heading,
        headingPath: chunk.headingPath,
        chunkIndex: chunk.chunkIndex,
        doc: { url: chunk.docUrl, title: chunk.docTitle },
        source: { id: chunk.sourceId, name: chunk.sourceName, type: chunk.sourceType },
      };

      return body;
    },
  );
}
