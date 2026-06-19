import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const mockListJobs = vi.fn();
const mockGetJob = vi.fn();

vi.mock("../../src/services/job-service.js", () => ({
  listJobs: (...args: unknown[]) => mockListJobs(...args),
  getJob: (...args: unknown[]) => mockGetJob(...args),
}));

import { registerJobRoutes } from "../../src/routes/jobs.js";

describe("Job routes", () => {
  const buildApp = async () => {
    const app = Fastify();
    await app.register(import("@fastify/swagger"), {
      openapi: { info: { title: "Test", version: "1.0.0" } },
    });
    registerJobRoutes(app);
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/jobs", () => {
    it("returns a list of jobs", async () => {
      mockListJobs.mockResolvedValue([
        { id: "job-1", sourceId: "src-1", type: "import", status: "done", error: null, startedAt: null, finishedAt: null, createdAt: new Date("2026-01-01") },
      ]);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/jobs" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe("job-1");
    });

    it("returns empty array when no jobs exist", async () => {
      mockListJobs.mockResolvedValue([]);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/jobs" });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toHaveLength(0);
    });
  });

  describe("GET /api/jobs/:id", () => {
    it("returns a job by ID", async () => {
      mockGetJob.mockResolvedValue({ id: "job-1", sourceId: "src-1", type: "import", status: "done", error: null, startedAt: null, finishedAt: null, createdAt: new Date("2026-01-01") });

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/jobs/job-1" });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).id).toBe("job-1");
    });

    it("returns 404 when job not found", async () => {
      mockGetJob.mockResolvedValue(null);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/jobs/missing" });

      expect(res.statusCode).toBe(404);
    });
  });
});
