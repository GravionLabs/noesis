import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const mockSearchDocs = vi.fn();

vi.mock("../../src/search/search.js", () => ({
  searchDocs: (...args: unknown[]) => mockSearchDocs(...args),
}));

import { registerSearchRoutes } from "../../src/routes/search.js";

const resultFixture = {
  chunkId: "chunk-1",
  sourceName: "Test Source",
  docTitle: "Test Doc",
  docUrl: "https://example.com/doc",
  heading: "Introduction",
  content: "This is the test content.",
  score: 0.95,
};

describe("Search routes", () => {
  const buildApp = async () => {
    const app = Fastify();
    await app.register(import("@fastify/swagger"), {
      openapi: { info: { title: "Test", version: "1.0.0" } },
    });
    registerSearchRoutes(app);
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/search", () => {
    it("returns results array for a known query", async () => {
      mockSearchDocs.mockResolvedValue([resultFixture]);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/search?q=test" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
      expect(body[0].chunkId).toBe("chunk-1");
      expect(body[0].sourceName).toBe("Test Source");
    });

    it("returns [] when no matches", async () => {
      mockSearchDocs.mockResolvedValue([]);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/search?q=nonexistent" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toEqual([]);
    });

    it("filters by source name", async () => {
      mockSearchDocs.mockImplementation(
        async (query: string, _limit?: number, source?: string) => {
          if (source === "Angular") {
            return [resultFixture];
          }
          return [];
        },
      );

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/search?q=test&source=Angular" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
      expect(mockSearchDocs).toHaveBeenCalledWith("test", 10, "Angular");
    });

    it("respects the limit param", async () => {
      mockSearchDocs.mockResolvedValue(Array.from({ length: 5 }, (_, i) => ({
        ...resultFixture,
        chunkId: `chunk-${i}`,
      })));

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/search?q=test&limit=5" });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(5);
      expect(mockSearchDocs).toHaveBeenCalledWith("test", 5, undefined);
    });

    it("returns 400 when q param is missing", async () => {
      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/search" });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when q param is empty", async () => {
      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/search?q=" });

      expect(res.statusCode).toBe(400);
    });

    it("limits max value to 50", async () => {
      mockSearchDocs.mockResolvedValue([]);

      const app = await buildApp();
      const res = await app.inject({ method: "GET", url: "/api/search?q=test&limit=100" });

      expect(res.statusCode).toBe(400);
    });
  });
});
