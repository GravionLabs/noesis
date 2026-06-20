import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const mockListJobs = vi.fn();
const mockGetJob = vi.fn();
const mockTriggerImport = vi.fn();

vi.mock("../../src/services/job-service.js", () => ({
  listJobs: (...args: unknown[]) => mockListJobs(...args),
  getJob: (...args: unknown[]) => mockGetJob(...args),
}));

vi.mock("../../src/services/import-service.js", () => ({
  triggerImport: (...args: unknown[]) => mockTriggerImport(...args),
}));

import { registerJobRoutes } from "../../src/routes/jobs.js";

const jobFixture = {
  id: "00000000-0000-0000-0000-000000000001",
  sourceId: "00000000-0000-0000-0000-000000000002",
  type: "import",
  status: "done",
  error: null,
  startedAt: null,
  finishedAt: null,
  createdAt: new Date("2026-01-01"),
};

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
      mockListJobs.mockResolvedValue([jobFixture]);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/jobs" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe("00000000-0000-0000-0000-000000000001");
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
      mockGetJob.mockResolvedValue(jobFixture);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/jobs/00000000-0000-0000-0000-000000000001" });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).id).toBe("00000000-0000-0000-0000-000000000001");
    });

    it("returns 404 when job not found", async () => {
      mockGetJob.mockResolvedValue(null);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/jobs/00000000-0000-0000-0000-000000000099" });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /api/jobs/:id/retry", () => {
    it("returns 202 with new job id for failed job", async () => {
      mockGetJob.mockResolvedValue({ ...jobFixture, status: "failed", sourceId: "src-1" });
      mockTriggerImport.mockResolvedValue({ id: "new-job-1", status: "pending" });

      const app = await buildApp();
      const res = await app.inject({ method: "POST", url: "/api/jobs/00000000-0000-0000-0000-000000000001/retry" });

      expect(res.statusCode).toBe(202);
      const body = JSON.parse(res.body);
      expect(body.jobId).toBe("new-job-1");
      expect(mockTriggerImport).toHaveBeenCalledWith("src-1");
    });

    it("returns 404 when job not found", async () => {
      mockGetJob.mockResolvedValue(null);

      const app = await buildApp();
      const res = await app.inject({ method: "POST", url: "/api/jobs/00000000-0000-0000-0000-000000000099/retry" });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when job is not failed", async () => {
      mockGetJob.mockResolvedValue({ ...jobFixture, status: "done" });

      const app = await buildApp();
      const res = await app.inject({ method: "POST", url: "/api/jobs/00000000-0000-0000-0000-000000000001/retry" });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when job has no source reference", async () => {
      mockGetJob.mockResolvedValue({ ...jobFixture, status: "failed", sourceId: null });

      const app = await buildApp();
      const res = await app.inject({ method: "POST", url: "/api/jobs/00000000-0000-0000-0000-000000000001/retry" });

      expect(res.statusCode).toBe(400);
    });
  });
});
