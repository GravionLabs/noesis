import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import { registerInternalRoutes } from "../../src/routes/internal.js";
import type { Config } from "../../src/config/index.js";

const mockUpdateJobStatus = vi.fn();
const mockUpdateLastImported = vi.fn();

describe("Internal routes", () => {
  const buildApp = async (apiKey = "") => {
    const app = Fastify();
    registerInternalRoutes(app, {
      jobService: { updateJobStatus: mockUpdateJobStatus } as any,
      sourceService: { updateLastImported: mockUpdateLastImported } as any,
      config: { API_KEY: apiKey } as Config,
    });
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/internal/embed-completed", () => {
    it("marks the job done and updates lastImportedAt when no API key is configured", async () => {
      const app = await buildApp();

      const res = await app.inject({
        method: "POST",
        url: "/api/internal/embed-completed",
        payload: { jobId: "job-1", sourceId: "source-1" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ status: "ok" });
      expect(mockUpdateJobStatus).toHaveBeenCalledWith("job-1", "done");
      expect(mockUpdateLastImported).toHaveBeenCalledWith("source-1");
    });

    it("rejects with 401 when an API key is required and missing", async () => {
      const app = await buildApp("secret-key");

      const res = await app.inject({
        method: "POST",
        url: "/api/internal/embed-completed",
        payload: { jobId: "job-1", sourceId: "source-1" },
      });

      expect(res.statusCode).toBe(401);
      expect(mockUpdateJobStatus).not.toHaveBeenCalled();
      expect(mockUpdateLastImported).not.toHaveBeenCalled();
    });

    it("succeeds when the correct API key header is provided", async () => {
      const app = await buildApp("secret-key");

      const res = await app.inject({
        method: "POST",
        url: "/api/internal/embed-completed",
        headers: { "x-api-key": "secret-key" },
        payload: { jobId: "job-1", sourceId: "source-1" },
      });

      expect(res.statusCode).toBe(200);
      expect(mockUpdateJobStatus).toHaveBeenCalledWith("job-1", "done");
    });
  });
});
