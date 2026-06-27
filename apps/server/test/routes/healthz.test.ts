import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { sql } from "drizzle-orm";

const mockIsSchedulerRunning = vi.fn();
const mockIsLeader = vi.fn();
const mockGetPendingJobCount = vi.fn();
const mockGetTotalSourceCount = vi.fn();
const mockDbExecute = vi.fn();
const mockHealth = vi.fn();

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
      database: { db: { execute: mockDbExecute } } as any,
      scheduler: { isSchedulerRunning: mockIsSchedulerRunning, isLeader: mockIsLeader } as any,
      embeddingService: { getProvider: () => ({ health: mockHealth }) } as any,
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
    it("returns 200 ok with config and stats when all dependencies are healthy", async () => {
      mockIsSchedulerRunning.mockReturnValue(true);
      mockIsLeader.mockReturnValue(true);
      mockGetPendingJobCount.mockResolvedValue(5);
      mockGetTotalSourceCount.mockResolvedValue(10);
      mockDbExecute.mockResolvedValue({ rows: [{ "?column?": 1 }] });
      mockHealth.mockResolvedValue(true);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/healthz/ready" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("ok");
      expect(body.provider).toBe("local");
      expect(body.model).toBe("test-model");
      expect(body.dimensions).toBe(768);
      expect(body.schedulerRunning).toBe(true);
      expect(body.schedulerLeader).toBe(true);
      expect(body.pendingJobs).toBe(5);
      expect(body.totalSources).toBe(10);
    });

    it("returns 503 degraded when database is unreachable", async () => {
      mockIsSchedulerRunning.mockReturnValue(true);
      mockIsLeader.mockReturnValue(false);
      mockGetPendingJobCount.mockResolvedValue(0);
      mockGetTotalSourceCount.mockResolvedValue(0);
      mockDbExecute.mockRejectedValue(new Error("connection refused"));
      mockHealth.mockResolvedValue(true);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/healthz/ready" });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("degraded");
      expect(body.db).toBe("unreachable");
      expect(body.embedding).toBeUndefined();
    });

    it("returns 503 degraded when embedding provider is unhealthy", async () => {
      mockIsSchedulerRunning.mockReturnValue(false);
      mockIsLeader.mockReturnValue(false);
      mockGetPendingJobCount.mockResolvedValue(0);
      mockGetTotalSourceCount.mockResolvedValue(0);
      mockDbExecute.mockResolvedValue({ rows: [{ "?column?": 1 }] });
      mockHealth.mockResolvedValue(false);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/healthz/ready" });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("degraded");
      expect(body.embedding).toBe("unreachable");
      expect(body.db).toBeUndefined();
    });

    it("returns 503 degraded when both db and embedding fail", async () => {
      mockIsSchedulerRunning.mockReturnValue(false);
      mockIsLeader.mockReturnValue(false);
      mockGetPendingJobCount.mockResolvedValue(0);
      mockGetTotalSourceCount.mockResolvedValue(0);
      mockDbExecute.mockRejectedValue(new Error("timeout"));
      mockHealth.mockRejectedValue(new Error("connection failed"));

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/healthz/ready" });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("degraded");
      expect(body.db).toBe("unreachable");
      expect(body.embedding).toBe("unreachable");
    });
  });
});
