import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const mockIsSchedulerRunning = vi.fn();
const mockGetPendingJobCount = vi.fn();
const mockGetTotalSourceCount = vi.fn();

import { registerHealthzRoutes } from "../../src/routes/healthz.js";

describe("Healthz routes", () => {
  const buildApp = async () => {
    const app = Fastify();
    registerHealthzRoutes(app, {
      config: {
        EMBEDDING_PROVIDER: "local",
        EMBEDDING_MODEL: "test-model",
        EMBEDDING_DIMENSIONS: 768,
      } as any,
      scheduler: { isSchedulerRunning: mockIsSchedulerRunning } as any,
      jobService: { getPendingJobCount: mockGetPendingJobCount } as any,
      sourceService: { getTotalSourceCount: mockGetTotalSourceCount } as any,
    });
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /healthz/live", () => {
    it("returns alive status", async () => {
      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/healthz/live" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("alive");
    });
  });

  describe("GET /healthz/ready", () => {
    it("returns health with embedding config and runtime stats", async () => {
      mockIsSchedulerRunning.mockReturnValue(true);
      mockGetPendingJobCount.mockResolvedValue(5);
      mockGetTotalSourceCount.mockResolvedValue(10);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/healthz/ready" });

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
