import type { FastifyInstance } from "fastify";
import type { SearchService } from "../services/search-service.js";

export function registerSearchRoutes(
  app: FastifyInstance,
  deps: { searchService: SearchService },
) {
  app.get("/api/search", async (req, reply) => {
    const { q, source, limit: limitParam } = req.query as {
      q?: string;
      source?: string;
      limit?: string;
    };

    if (!q || q.trim().length === 0) {
      return reply.code(400).send({ error: "Missing required query parameter: q" });
    }

    let limit = Number(limitParam) || 10;
    if (limitParam && Number(limitParam) > 50) {
      return reply.code(400).send({ error: "Limit cannot exceed 50" });
    }
    if (limit < 1) limit = 1;

    const results = await deps.searchService.searchDocs(q, limit, source);
    return results;
  });
}
