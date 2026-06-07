import type { FastifyInstance } from "fastify";
import { config } from "../config.js";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/alive", async () => ({ status: "alive" }));

  app.get("/health", async () => ({
    status: "ok",
    provider: config.EMBEDDING_PROVIDER,
    model: config.EMBEDDING_MODEL,
    dimensions: config.EMBEDDING_DIMENSIONS,
  }));
}
