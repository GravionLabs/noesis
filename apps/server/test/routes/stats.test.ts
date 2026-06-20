import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const mockGetStats = vi.fn();

import { registerStatsRoutes } from "../../src/routes/stats.js";

describe("Stats routes", () => {
  const buildApp = async () => {
    const app = Fastify();
    registerStatsRoutes(app, {
      statsService: { getStats: mockGetStats } as any,
    });
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/stats", () => {
    it("returns summary statistics", async () => {
      mockGetStats.mockResolvedValue({
        totalSources: 3,
        totalDocs: 10,
        totalChunks: 100,
        totalEmbeddings: 90,
        totalJobs: 42,
        avgImportDurationMs: 1500,
        storageBytes: 50000,
      });

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/stats" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toEqual({
        totalSources: 3,
        totalDocs: 10,
        totalChunks: 100,
        totalEmbeddings: 90,
        totalJobs: 42,
        avgImportDurationMs: 1500,
        storageBytes: 50000,
      });
    });
  });
});
