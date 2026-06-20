import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const mockGetTotalSourceCount = vi.fn();
const mockGetTotalJobCount = vi.fn();
const mockGetAvgImportDuration = vi.fn();
const mockQuery = vi.fn();

vi.mock("../../src/services/source-service.js", () => ({
  getTotalSourceCount: (...args: unknown[]) => mockGetTotalSourceCount(...args),
}));

vi.mock("../../src/services/job-service.js", () => ({
  getTotalJobCount: (...args: unknown[]) => mockGetTotalJobCount(...args),
  getAvgImportDuration: (...args: unknown[]) => mockGetAvgImportDuration(...args),
}));

vi.mock("../../src/db/pool.js", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

import { registerStatsRoutes } from "../../src/routes/stats.js";

describe("Stats routes", () => {
  const buildApp = async () => {
    const app = Fastify();
    registerStatsRoutes(app);
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/stats", () => {
    it("returns summary statistics", async () => {
      mockGetTotalSourceCount.mockResolvedValue(3);
      mockGetTotalJobCount.mockResolvedValue(42);
      mockGetAvgImportDuration.mockResolvedValue(1500);

      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: 10 }] })
        .mockResolvedValueOnce({ rows: [{ count: 100 }] })
        .mockResolvedValueOnce({ rows: [{ count: 90 }] })
        .mockResolvedValueOnce({ rows: [{ bytes: 50000 }] });

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
