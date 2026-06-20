import type { FastifyInstance } from "fastify";
import { searchDocs } from "../search/search.js";

const searchQuerySchema = {
  tags: ["Search"],
  querystring: {
    type: "object",
    required: ["q"],
    properties: {
      q: { type: "string", minLength: 1 },
      source: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 10 },
    },
  },
  response: {
    200: {
      type: "array",
      items: {
        type: "object",
        properties: {
          chunkId: { type: "string" },
          sourceName: { type: "string" },
          docTitle: { type: "string", nullable: true },
          docUrl: { type: "string" },
          heading: { type: "string", nullable: true },
          content: { type: "string" },
          score: { type: "number" },
        },
      },
    },
  },
};

export function registerSearchRoutes(app: FastifyInstance) {
  app.get("/api/search", { schema: searchQuerySchema }, async (req) => {
    const { q, source, limit } = req.query as {
      q: string;
      source?: string;
      limit?: number;
    };

    const results = await searchDocs(q, limit, source);
    return results;
  });
}
