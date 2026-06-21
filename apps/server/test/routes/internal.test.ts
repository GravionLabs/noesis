import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const mockConfig: { API_KEY: string } = { API_KEY: "" };

vi.mock("../../src/config.js", () => ({
  get config() {
    return mockConfig;
  },
}));

const mockUpdateJobStatus = vi.fn();
const mockUpdateLastImported = vi.fn();

import { registerInternalRoutes } from "../../src/routes/internal.js";

describe("Internal routes", () => {
  const buildApp = async () => {
    const app = Fastify();
    registerInternalRoutes(app, {
      jobService: { updateJobStatus: mockUpdateJobStatus } as any,
      sourceService: { updateLastImported: mockUpdateLastImported } as any,
    });
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.API_KEY = "";
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
      mockConfig.API_KEY = "secret-key";
      const app = await buildApp();

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
      mockConfig.API_KEY = "secret-key";
      const app = await buildApp();

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
