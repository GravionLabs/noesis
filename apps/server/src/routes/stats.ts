import type { FastifyInstance } from "fastify";
import type { StatsService } from "../services/stats-service.js";

export function registerStatsRoutes(
  app: FastifyInstance,
  deps: { statsService: StatsService },
) {
  app.get("/api/stats", async () => {
    return deps.statsService.getStats();
  });
}
