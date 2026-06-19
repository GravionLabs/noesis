import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const mockListSources = vi.fn();
const mockCreateSource = vi.fn();
const mockDeleteSource = vi.fn();
const mockTriggerImport = vi.fn();

vi.mock("../../src/services/source-service.js", () => ({
  listSources: (...args: unknown[]) => mockListSources(...args),
  createSource: (...args: unknown[]) => mockCreateSource(...args),
  getSource: vi.fn(),
  deleteSource: (...args: unknown[]) => mockDeleteSource(...args),
}));

vi.mock("../../src/services/import-service.js", () => ({
  triggerImport: (...args: unknown[]) => mockTriggerImport(...args),
}));

vi.mock("../../src/pipeline/scheduler.js", () => ({
  isValidCron: (...args: unknown[]) => vi.fn()(...args),
}));

import { registerSourceRoutes } from "../../src/routes/sources.js";

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
      mockListSources.mockResolvedValue([
        { id: "src-1", name: "Test", url: "https://example.com", importerType: "llmstxt", enabled: true, config: null, schedule: null, lastImportedAt: null },
      ]);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/sources" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
      expect(body[0].name).toBe("Test");
    });
  });

  describe("POST /api/sources", () => {
    it("creates a source and returns 201", async () => {
      mockCreateSource.mockResolvedValue({ id: "src-1", name: "Test", url: "https://example.com", importerType: "llmstxt", enabled: true });

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
