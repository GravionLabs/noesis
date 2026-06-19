import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const mockListSources = vi.fn();
const mockCreateSource = vi.fn();
const mockGetSource = vi.fn();
const mockUpdateSource = vi.fn();
const mockDeleteSource = vi.fn();
const mockTriggerImport = vi.fn();
const mockScheduleNextRun = vi.fn();
const mockIsValidCron = vi.fn().mockReturnValue(true);

vi.mock("../../src/services/source-service.js", () => ({
  listSources: (...args: unknown[]) => mockListSources(...args),
  createSource: (...args: unknown[]) => mockCreateSource(...args),
  getSource: (...args: unknown[]) => mockGetSource(...args),
  updateSource: (...args: unknown[]) => mockUpdateSource(...args),
  deleteSource: (...args: unknown[]) => mockDeleteSource(...args),
}));

vi.mock("../../src/services/import-service.js", () => ({
  triggerImport: (...args: unknown[]) => mockTriggerImport(...args),
}));

vi.mock("../../src/pipeline/scheduler.js", () => ({
  isValidCron: (...args: unknown[]) => mockIsValidCron(...args),
  scheduleNextRun: (...args: unknown[]) => mockScheduleNextRun(...args),
}));

import { registerSourceRoutes } from "../../src/routes/sources.js";

const sourceFixture = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Test",
  url: "https://example.com",
  importerType: "llmstxt",
  enabled: true,
  config: null,
  schedule: null,
  lastImportedAt: null,
};

describe("Source routes", () => {
  const buildApp = async () => {
    const app = Fastify();
    await app.register(import("@fastify/swagger"), {
      openapi: { info: { title: "Test", version: "1.0.0" } },
    });
    registerSourceRoutes(app);
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/sources", () => {
    it("returns a list of sources", async () => {
      mockListSources.mockResolvedValue([sourceFixture]);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/sources" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("Test");
    });
  });

  describe("GET /api/sources/:id", () => {
    it("returns 200 with source object", async () => {
      mockGetSource.mockResolvedValue(sourceFixture);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/sources/00000000-0000-0000-0000-000000000001" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(sourceFixture.id);
      expect(body.name).toBe("Test");
    });

    it("returns 404 for unknown ID", async () => {
      mockGetSource.mockResolvedValue(null);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/sources/00000000-0000-0000-0000-000000000099" });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /api/sources", () => {
    it("creates a source and returns 201", async () => {
      mockCreateSource.mockResolvedValue(sourceFixture);

      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/sources",
        payload: { name: "Test", url: "https://example.com" },
      });

      expect(res.statusCode).toBe(201);
    });

    it("returns 400 for invalid body", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/sources",
        payload: { name: "" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 409 for duplicate URL", async () => {
      mockCreateSource.mockResolvedValue(null);

      const app = await buildApp();
      const res = await app.inject({
        method: "POST",
        url: "/api/sources",
        payload: { name: "Dup", url: "https://example.com" },
      });

      expect(res.statusCode).toBe(409);
    });

    it("calls scheduleNextRun when source has a schedule", async () => {
      mockCreateSource.mockResolvedValue({ ...sourceFixture, schedule: "0 * * * *" });

      const app = await buildApp();
      await app.inject({
        method: "POST",
        url: "/api/sources",
        payload: { name: "Test", url: "https://example.com", schedule: "0 * * * *" },
      });

      expect(mockScheduleNextRun).toHaveBeenCalledTimes(1);
    });
  });

  describe("PATCH /api/sources/:id", () => {
    it("updates name and returns 200", async () => {
      mockUpdateSource.mockResolvedValue({ ...sourceFixture, name: "Updated" });

      const app = await buildApp();
      const res = await app.inject({
        method: "PATCH",
        url: "/api/sources/00000000-0000-0000-0000-000000000001",
        payload: { name: "Updated" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.name).toBe("Updated");
    });

    it("updates schedule and returns 200", async () => {
      mockUpdateSource.mockResolvedValue({ ...sourceFixture, schedule: "0 */2 * * *" });

      const app = await buildApp();
      const res = await app.inject({
        method: "PATCH",
        url: "/api/sources/00000000-0000-0000-0000-000000000001",
        payload: { schedule: "0 */2 * * *" },
      });

      expect(res.statusCode).toBe(200);
      expect(mockScheduleNextRun).toHaveBeenCalledTimes(1);
    });

    it("returns 404 for unknown ID", async () => {
      mockUpdateSource.mockResolvedValue(null);

      const app = await buildApp();
      const res = await app.inject({
        method: "PATCH",
        url: "/api/sources/00000000-0000-0000-0000-000000000099",
        payload: { name: "Nope" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for invalid cron schedule", async () => {
      mockIsValidCron.mockReturnValueOnce(false);

      const app = await buildApp();
      const res = await app.inject({
        method: "PATCH",
        url: "/api/sources/00000000-0000-0000-0000-000000000001",
        payload: { schedule: "not-a-cron" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("DELETE /api/sources/:id", () => {
    it("deletes a source and returns 204", async () => {
      mockDeleteSource.mockResolvedValue(true);

      const app = await buildApp();
      const res = await app.inject({ method: "DELETE", url: "/api/sources/00000000-0000-0000-0000-000000000001" });

      expect(res.statusCode).toBe(204);
    });

    it("returns 404 when source not found", async () => {
      mockDeleteSource.mockResolvedValue(false);

      const app = await buildApp();
      const res = await app.inject({ method: "DELETE", url: "/api/sources/00000000-0000-0000-0000-000000000099" });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /api/sources/:id/import", () => {
    it("triggers import and returns 202", async () => {
      mockTriggerImport.mockResolvedValue({ id: "job-1", status: "pending" });

      const app = await buildApp();
      const res = await app.inject({ method: "POST", url: "/api/sources/00000000-0000-0000-0000-000000000001/import" });

      expect(res.statusCode).toBe(202);
      const body = JSON.parse(res.body);
      expect(body.jobId).toBe("job-1");
    });

    it("returns 404 when source not found", async () => {
      mockTriggerImport.mockRejectedValue(new Error("Source not found"));

      const app = await buildApp();
      const res = await app.inject({ method: "POST", url: "/api/sources/00000000-0000-0000-0000-000000000099/import" });

      expect(res.statusCode).toBe(404);
    });
  });
});
