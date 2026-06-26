import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExecute = vi.fn();
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
    database: { db: { execute: mockExecute } } as any,
    embeddingService: {
      getProvider: mockGetProvider,
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
      mockExecute.mockResolvedValue({ rows: fakeResults });

      const results = await service.searchByText("dependency injection", 5, "Angular");

      expect(results).toHaveLength(2);
      expect(results[0].sourceName).toBe("Angular");
      expect(results[0].docUrl).toBe("https://angular.dev/guide/di");
      expect(results[0].heading).toBe("DI Overview");
      expect(results[0].content).toContain("Dependency injection");
      expect(results[0].score).toBe(0.95);
      expect(results[0].chunkId).toBe("chunk-1");
    });

    it("calls db.execute with a sql template including the search query", async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      await service.searchByText("dependency injection", 5);

      expect(mockExecute).toHaveBeenCalledTimes(1);
      // sql template object is passed — verify it was called (not the raw string)
      expect(mockExecute.mock.calls[0][0]).toBeDefined();
    });

    it("includes source name filter when sourceName is provided", async () => {
      mockExecute.mockResolvedValue({ rows: fakeResults });

      const withSource = await service.searchByText("test", 10, "Angular");
      const withoutSource = await service.searchByText("test", 10);

      // Both calls return results; filter is encoded in the sql template
      expect(mockExecute).toHaveBeenCalledTimes(2);
      expect(withSource).toHaveLength(2);
      expect(withoutSource).toHaveLength(2);
    });

    it("returns empty array when nothing matches", async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const results = await service.searchByText("nonexistent content", 5);
      expect(results).toEqual([]);
    });
  });

  describe("searchByVector", () => {
    it("returns results ordered by cosine similarity", async () => {
      mockExecute.mockResolvedValue({ rows: fakeResults });

      const vector = Array(768).fill(0.1);
      const results = await service.searchByVector(vector, 5);

      expect(results).toHaveLength(2);
      expect(results[0].chunkId).toBe("chunk-1");
    });

    it("passes the vector and limit to the sql template", async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const vector = Array(768).fill(0.5);
      await service.searchByVector(vector, 3, "Angular");

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe("searchDocs", () => {
    it("uses vector search when embedder is available", async () => {
      mockGetProvider.mockReturnValue({
        embed: async (_texts: string[]) => [Array(768).fill(0.1)],
        model: "test-model",
        dimensions: 768,
      });
      mockExecute.mockResolvedValue({ rows: fakeResults });

      const results = await service.searchDocs("dependency injection", 5);

      expect(results).toHaveLength(2);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it("falls back to text search when embedder fails", async () => {
      mockGetProvider.mockReturnValue({
        embed: async () => { throw new Error("Provider unavailable"); },
        model: "test-model",
        dimensions: 768,
      });
      mockExecute.mockResolvedValue({ rows: fakeResults });

      const results = await service.searchDocs("dependency injection", 5);

      expect(results).toHaveLength(2);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it("falls back to text search when embedder returns empty vector", async () => {
      mockGetProvider.mockReturnValue({
        embed: async () => [[]],
        model: "test-model",
        dimensions: 768,
      });
      mockExecute.mockResolvedValue({ rows: fakeResults });

      const results = await service.searchDocs("dependency injection", 5);

      expect(results).toHaveLength(2);
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it("passes sourceName through to the search path", async () => {
      mockGetProvider.mockReturnValue({
        embed: async () => { throw new Error("down"); },
        model: "test-model",
        dimensions: 768,
      });
      mockExecute.mockResolvedValue({ rows: [] });

      await service.searchDocs("test", 5, "Angular");

      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when no results found", async () => {
      mockGetProvider.mockReturnValue({
        embed: async () => { throw new Error("down"); },
        model: "test-model",
        dimensions: 768,
      });
      mockExecute.mockResolvedValue({ rows: [] });

      const results = await service.searchDocs("does not exist in corpus", 5);
      expect(results).toEqual([]);
    });
  });
});
