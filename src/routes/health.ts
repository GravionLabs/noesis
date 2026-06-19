import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

const aliveSchema = {
  tags: ["Health"],
  response: {
    200: {
      type: "object",
      properties: { status: { type: "string" } },
    },
  },
};

const healthSchema = {
  tags: ["Health"],
  response: {
    200: {
      type: "object",
      properties: {
        status: { type: "string" },
        provider: { type: "string" },
        model: { type: "string" },
        dimensions: { type: "number" },
      },
    },
  },
};

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/alive", { schema: aliveSchema }, async () => ({ status: "alive" }));

  app.get("/health", { schema: healthSchema }, async () => ({
    status: "ok",
    provider: config.EMBEDDING_PROVIDER,
    model: config.EMBEDDING_MODEL,
    dimensions: config.EMBEDDING_DIMENSIONS,
  }));
}
