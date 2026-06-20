import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const mockIsSchedulerRunning = vi.fn();
const mockGetPendingJobCount = vi.fn();
const mockGetTotalSourceCount = vi.fn();

vi.mock("../../src/pipeline/scheduler.js", () => ({
  isSchedulerRunning: (...args: unknown[]) => mockIsSchedulerRunning(...args),
}));

vi.mock("../../src/services/job-service.js", () => ({
  getPendingJobCount: (...args: unknown[]) => mockGetPendingJobCount(...args),
}));

vi.mock("../../src/services/source-service.js", () => ({
  getTotalSourceCount: (...args: unknown[]) => mockGetTotalSourceCount(...args),
}));

vi.mock("../../src/config.js", () => ({
  config: {
    EMBEDDING_PROVIDER: "local",
    EMBEDDING_MODEL: "test-model",
    EMBEDDING_DIMENSIONS: 768,
  },
}));

import { registerHealthRoutes } from "../../src/routes/health.js";

describe("Health routes", () => {
  const buildApp = async () => {
    const app = Fastify();
    registerHealthRoutes(app);
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /alive", () => {
    it("returns alive status", async () => {
      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/alive" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("alive");
    });
  });

  describe("GET /health", () => {
    it("returns health with embedding config and runtime stats", async () => {
      mockIsSchedulerRunning.mockReturnValue(true);
      mockGetPendingJobCount.mockResolvedValue(5);
      mockGetTotalSourceCount.mockResolvedValue(10);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/health" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("ok");
      expect(body.provider).toBe("local");
      expect(body.model).toBe("test-model");
      expect(body.dimensions).toBe(768);
      expect(body.schedulerRunning).toBe(true);
      expect(body.pendingJobs).toBe(5);
      expect(body.totalSources).toBe(10);
    });
  });
});
