import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const mockGetChunkWithSource = vi.fn();

import { registerChunkRoutes } from "../../src/routes/chunks.js";

const CHUNK_FIXTURE = {
  chunkId: "550e8400-e29b-41d4-a716-446655440000",
  content: "Full chunk content here",
  heading: "Introduction",
  headingPath: ["Root", "Introduction"],
  chunkIndex: 0,
  docUrl: "https://example.com/doc",
  docTitle: "Getting Started",
  sourceId: "660e8400-e29b-41d4-a716-446655440001",
  sourceName: "Docs",
  sourceType: "llmstxt",
};

describe("Chunk routes", () => {
  const buildApp = async () => {
    const app = Fastify();
    registerChunkRoutes(app, {
      chunkService: { getChunkWithSource: mockGetChunkWithSource } as any,
    });
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/chunks/:id", () => {
    it("returns 200 with chunk details for a valid ID", async () => {
      mockGetChunkWithSource.mockResolvedValue(CHUNK_FIXTURE);

      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/chunks/550e8400-e29b-41d4-a716-446655440000",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(CHUNK_FIXTURE.chunkId);
      expect(body.content).toBe(CHUNK_FIXTURE.content);
      expect(body.heading).toBe(CHUNK_FIXTURE.heading);
      expect(body.headingPath).toEqual(CHUNK_FIXTURE.headingPath);
      expect(body.chunkIndex).toBe(CHUNK_FIXTURE.chunkIndex);
      expect(body.doc).toEqual({ url: CHUNK_FIXTURE.docUrl, title: CHUNK_FIXTURE.docTitle });
      expect(body.source).toEqual({
        id: CHUNK_FIXTURE.sourceId,
        name: CHUNK_FIXTURE.sourceName,
        type: CHUNK_FIXTURE.sourceType,
      });
    });

    it("returns 404 for an unknown chunk ID", async () => {
      mockGetChunkWithSource.mockResolvedValue(null);

      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/chunks/550e8400-e29b-41d4-a716-446655440000",
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.error).toBe("Chunk not found");
    });

    it("returns 400 for a malformed UUID", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/chunks/not-a-uuid",
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.error).toBe("Invalid chunk ID");
    });

    it("returns 404 for valid UUID format but unknown chunk", async () => {
      mockGetChunkWithSource.mockResolvedValue(null);

      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/chunks/00000000-0000-0000-0000-000000000000",
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
