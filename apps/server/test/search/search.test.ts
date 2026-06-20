import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();
const mockGetProvider = vi.fn();

import { SearchService } from "../../src/services/search-service.js";

const fakeResults = [
  {
    chunk_id: "chunk-1",
    content: "Dependency injection is a pattern where components receive their dependencies.",
    heading: "DI Overview",
    doc_url: "https://angular.dev/guide/di",
    doc_title: "Angular DI Guide",
    source_name: "Angular",
    score: 0.95,
  },
  {
    chunk_id: "chunk-2",
    content: "Use provide() to register a dependency with the injector.",
    heading: "Providing Dependencies",
    doc_url: "https://angular.dev/guide/di/providers",
    doc_title: "Angular DI Guide",
    source_name: "Angular",
    score: 0.82,
  },
];

function createService() {
  return new SearchService({
    database: { query: mockQuery } as any,
    embeddingService: {
      getProvider: mockGetProvider,
      embedTexts: () => [],
      embedText: () => [],
      embedUnembeddedChunks: () => 0,
    } as any,
  });
}

describe("SearchService", () => {
  let service: SearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  describe("searchByText", () => {
    it("returns mapped results from full-text search", async () => {
      mockQuery.mockResolvedValue({ rows: fakeResults });

      const results = await service.searchByText("dependency injection", 5, "Angular");

      expect(results).toHaveLength(2);
      expect(results[0].sourceName).toBe("Angular");
      expect(results[0].docUrl).toBe("https://angular.dev/guide/di");
      expect(results[0].heading).toBe("DI Overview");
      expect(results[0].content).toContain("Dependency injection");
      expect(results[0].score).toBe(0.95);
      expect(results[0].chunkId).toBe("chunk-1");
    });

    it("filters by source name when provided", async () => {
      mockQuery.mockResolvedValue({ rows: fakeResults });

      await service.searchByText("test", 10, "Angular");
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain("AND s.name = $2");
    });

    it("omits source filter when not provided", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await service.searchByText("test", 10);
      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).not.toContain("AND s.name");
    });

    it("returns empty array when nothing matches", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const results = await service.searchByText("nonexistent content", 5);
      expect(results).toEqual([]);
    });
  });

  describe("searchByVector", () => {
    it("returns results ordered by cosine similarity", async () => {
      mockQuery.mockResolvedValue({ rows: fakeResults });

      const vector = Array(768).fill(0.1);
      const results = await service.searchByVector(vector, 5);

      expect(results).toHaveLength(2);
      expect(results[0].chunkId).toBe("chunk-1");
    });

    it("filters by source name when provided", async () => {
      mockQuery.mockResolvedValue({ rows: fakeResults });

      const vector = Array(768).fill(0.1);
      await service.searchByVector(vector, 5, "Angular");

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain("AND s.name = $3");
    });
  });

  describe("searchDocs", () => {
    it("uses vector search when embedder is available", async () => {
      mockGetProvider.mockReturnValue({
        embed: async (texts: string[]) => [Array(768).fill(0.1)],
        model: "test-model",
        dimensions: 768,
      });
      mockQuery.mockResolvedValue({ rows: fakeResults });

      const results = await service.searchDocs("dependency injection", 5);

      expect(results).toHaveLength(2);
      expect(mockQuery.mock.calls[0][0] as string).toContain("vector <=>");
    });

    it("falls back to text search when embedder fails", async () => {
      mockGetProvider.mockReturnValue({
        embed: async () => {
          throw new Error("Provider unavailable");
        },
        model: "test-model",
        dimensions: 768,
      });
      mockQuery.mockResolvedValue({ rows: fakeResults });

      const results = await service.searchDocs("dependency injection", 5);

      expect(results).toHaveLength(2);
      const lastCall = mockQuery.mock.calls[mockQuery.mock.calls.length - 1][0] as string;
      expect(lastCall).toContain("to_tsvector");
    });

    it("falls back to text search when embedder returns empty vector", async () => {
      mockGetProvider.mockReturnValue({
        embed: async () => [[]],
        model: "test-model",
        dimensions: 768,
      });

      mockQuery.mockResolvedValue({ rows: fakeResults });

      const results = await service.searchDocs("dependency injection", 5);

      expect(results).toHaveLength(2);
      expect(mockQuery.mock.calls[0][0] as string).not.toContain("vector <=>");
    });

    it("passes sourceName to both search paths", async () => {
      mockGetProvider.mockReturnValue({
        embed: async () => {
          throw new Error("down");
        },
        model: "test-model",
        dimensions: 768,
      });
      mockQuery.mockResolvedValue({ rows: [] });

      await service.searchDocs("test", 5, "Angular");

      const sql = mockQuery.mock.calls[0][0] as string;
      expect(sql).toContain("AND s.name = $2");
    });

    it("returns empty array when no results found", async () => {
      mockGetProvider.mockReturnValue({
        embed: async () => {
          throw new Error("down");
        },
        model: "test-model",
        dimensions: 768,
      });
      mockQuery.mockResolvedValue({ rows: [] });

      const results = await service.searchDocs("does not exist in corpus", 5);
      expect(results).toEqual([]);
    });
  });
});
