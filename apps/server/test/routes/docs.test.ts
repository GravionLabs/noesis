import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";

const mockListDocsBySourceId = vi.fn();
const mockGetChunksByDocId = vi.fn();
const mockGetSource = vi.fn();

import { registerDocRoutes } from "../../src/routes/docs.js";

const SOURCE_FIXTURE = {
  id: "660e8400-e29b-41d4-a716-446655440001",
  name: "Docs",
  url: "https://example.com",
  importerType: "llmstxt",
  enabled: true,
  config: null,
  schedule: null,
  lastImportedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const DOCS_FIXTURE = [
  { id: "770e8400-e29b-41d4-a716-446655440002", url: "https://example.com/doc1", title: "Doc One", chunkCount: 3 },
  { id: "770e8400-e29b-41d4-a716-446655440003", url: "https://example.com/doc2", title: "Doc Two", chunkCount: 5 },
];

const CHUNKS_FIXTURE = [
  {
    id: "880e8400-e29b-41d4-a716-446655440004",
    docId: "770e8400-e29b-41d4-a716-446655440002",
    sourceId: "660e8400-e29b-41d4-a716-446655440001",
    content: "Chunk content",
    heading: "Intro",
    headingPath: ["Intro"],
    chunkIndex: 0,
    tokenCount: 10,
    createdAt: new Date().toISOString(),
  },
];

describe("Doc routes", () => {
  const buildApp = async () => {
    const app = Fastify();
    registerDocRoutes(app, {
      chunkService: {
        listDocsBySourceId: mockListDocsBySourceId,
        getChunksByDocId: mockGetChunksByDocId,
      } as any,
      sourceService: {
        getSource: mockGetSource,
      } as any,
    });
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/sources/:id/docs", () => {
    it("returns 200 with docs list for a valid source", async () => {
      mockGetSource.mockResolvedValue(SOURCE_FIXTURE);
      mockListDocsBySourceId.mockResolvedValue(DOCS_FIXTURE);

      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/sources/660e8400-e29b-41d4-a716-446655440001/docs",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(2);
      expect(body[0].url).toBe("https://example.com/doc1");
      expect(body[0].chunkCount).toBe(3);
    });

    it("returns 404 for an unknown source", async () => {
      mockGetSource.mockResolvedValue(null);

      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/sources/660e8400-e29b-41d4-a716-446655440001/docs",
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for malformed UUID", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/sources/not-a-uuid/docs",
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /api/docs/:id/chunks", () => {
    it("returns 200 with chunks list for a valid doc", async () => {
      mockGetChunksByDocId.mockResolvedValue(CHUNKS_FIXTURE);

      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/docs/770e8400-e29b-41d4-a716-446655440002/chunks",
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body).toHaveLength(1);
      expect(body[0].heading).toBe("Intro");
      expect(body[0].chunkIndex).toBe(0);
    });

    it("returns 404 for unknown doc", async () => {
      mockGetChunksByDocId.mockResolvedValue([]);

      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/docs/00000000-0000-0000-0000-000000000000/chunks",
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 for malformed UUID", async () => {
      const app = await buildApp();
      const res = await app.inject({
        method: "GET",
        url: "/api/docs/not-a-uuid/chunks",
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
