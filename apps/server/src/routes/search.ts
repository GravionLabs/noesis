import type { FastifyInstance } from "fastify";
import type { SearchService } from "../services/search-service.js";

export function registerSearchRoutes(
  app: FastifyInstance,
  deps: { searchService: SearchService },
) {
  app.get("/api/search", async (req) => {
    const { q, source, limit } = req.query as {
      q: string;
      source?: string;
      limit?: number;
    };

    const results = await deps.searchService.searchDocs(q, limit, source);
    return results;
  });
}
