import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();
const mockGetClient = vi.fn();

import { ChunkService } from "../../src/services/chunk-service.js";
import type { CrawlChunkData } from "../../src/services/chunk-service.js";

function createService() {
  return new ChunkService({
    database: {
      query: mockQuery,
      getClient: mockGetClient,
    } as any,
  });
}

describe("ChunkService", () => {
  let service: ChunkService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClient.mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });
    service = createService();
  });

  describe("getChunkWithSource", () => {
    it("returns the mapped chunk when found", async () => {
      const row = {
        chunkId: "chunk-1",
        content: "some content",
        heading: "Intro",
        headingPath: ["Intro"],
        chunkIndex: 0,
        docUrl: "https://example.com/doc",
        docTitle: "Doc Title",
        sourceId: "source-1",
        sourceName: "Example",
      };
      mockQuery.mockResolvedValue({ rows: [row] });

      const result = await service.getChunkWithSource("chunk-1");

      expect(result).toEqual(row);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE c.id = $1"),
        ["chunk-1"],
      );
    });

    it("returns null when no chunk matches", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const result = await service.getChunkWithSource("missing-id");

      expect(result).toBeNull();
    });
  });

  describe("getChunksByDocId", () => {
    it("returns rows ordered by chunk_index", async () => {
      const rows = [{ id: "c1" }, { id: "c2" }];
      mockQuery.mockResolvedValue({ rows });

      const result = await service.getChunksByDocId("doc-1");

      expect(result).toEqual(rows);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE doc_id = $1"),
        ["doc-1"],
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY chunk_index"),
        ["doc-1"],
      );
    });
  });

  describe("getChunksBySourceId", () => {
    it("returns rows ordered by created_at desc", async () => {
      const rows = [{ id: "c1" }];
      mockQuery.mockResolvedValue({ rows });

      const result = await service.getChunksBySourceId("source-1");

      expect(result).toEqual(rows);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE source_id = $1"),
        ["source-1"],
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY created_at DESC"),
        ["source-1"],
      );
    });
  });

  describe("saveChunks", () => {
    const baseChunk: CrawlChunkData = {
      docUrl: "https://example.com/doc",
      docTitle: "Doc Title",
      content: "hello world this is content",
      heading: "Intro",
      headingPath: ["Intro"],
      chunkIndex: 0,
    };

    it("returns zero counts when given an empty array", async () => {
      const result = await service.saveChunks([], "source-1");

      expect(result).toEqual({ docCount: 0, chunkCount: 0 });
      expect(mockGetClient).not.toHaveBeenCalled();
    });

    it("inserts docs and chunks within a transaction and commits", async () => {
      mockClientQuery.mockImplementation((sql: string) => {
        if (sql.startsWith("BEGIN") || sql.startsWith("COMMIT")) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes("INSERT INTO docs")) {
          return Promise.resolve({ rows: [{ id: "doc-1" }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await service.saveChunks([baseChunk], "source-1");

      expect(result).toEqual({ docCount: 1, chunkCount: 1 });
      expect(mockClientQuery).toHaveBeenCalledWith("BEGIN");
      expect(mockClientQuery).toHaveBeenCalledWith("COMMIT");
      expect(mockRelease).toHaveBeenCalled();
    });

    it("uses the content_md insert path when docContentMd is provided", async () => {
      mockClientQuery.mockImplementation((sql: string) => {
        if (sql.includes("INSERT INTO docs")) {
          return Promise.resolve({ rows: [{ id: "doc-1" }] });
        }
        return Promise.resolve({ rows: [] });
      });

      await service.saveChunks(
        [{ ...baseChunk, docContentMd: "# Doc Title\n\nhello" }],
        "source-1",
      );

      const docInsertCall = mockClientQuery.mock.calls.find(([sql]) =>
        sql.includes("INSERT INTO docs"),
      );
      expect(docInsertCall![0]).toContain("content_md");
    });

    it("counts each distinct docUrl once across multiple chunks", async () => {
      mockClientQuery.mockImplementation((sql: string) => {
        if (sql.includes("INSERT INTO docs")) {
          return Promise.resolve({ rows: [{ id: "doc-1" }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const chunks: CrawlChunkData[] = [
        { ...baseChunk, chunkIndex: 0 },
        { ...baseChunk, chunkIndex: 1 },
      ];

      const result = await service.saveChunks(chunks, "source-1");

      expect(result).toEqual({ docCount: 1, chunkCount: 2 });
    });

    it("rolls back and rethrows on failure", async () => {
      mockClientQuery.mockImplementation((sql: string) => {
        if (sql.startsWith("BEGIN") || sql.startsWith("ROLLBACK")) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes("INSERT INTO docs")) {
          throw new Error("db failure");
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(service.saveChunks([baseChunk], "source-1")).rejects.toThrow(
        "db failure",
      );

      expect(mockClientQuery).toHaveBeenCalledWith("ROLLBACK");
      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe("purgeNoisyChunks", () => {
    it("deletes chunks classified as link-list noise and returns purged count", async () => {
      const noisyContent = [
        "- [Zoneless change detection](/guide/zoneless)",
        "- [Linked Signal API](/guide/signals/linked-signal)",
        "- [Incremental hydration](/guide/incremental-hydration)",
        "- [Resource API](/guide/resource)",
        "- [Component testing](/guide/testing/components)",
      ].join("\n");

      const cleanContent =
        "Angular is a platform and framework for building single-page client applications. " +
        "It implements core and optional functionality as a set of TypeScript libraries.";

      mockQuery.mockImplementation((sql: string) => {
        if (sql.includes("SELECT id, content FROM chunks")) {
          return Promise.resolve({
            rows: [
              { id: "noisy-1", content: noisyContent },
              { id: "clean-1", content: cleanContent },
              { id: "noisy-2", content: noisyContent },
            ],
          });
        }
        if (sql.includes("DELETE FROM chunks")) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const result = await service.purgeNoisyChunks("source-1");

      expect(result).toEqual({ purged: 2 });

      const deleteSql = mockQuery.mock.calls.find(([sql]) => sql.includes("DELETE FROM chunks"));
      expect(deleteSql).toBeDefined();
      expect(deleteSql![1]).toEqual([["noisy-1", "noisy-2"]]);
    });

    it("returns { purged: 0 } for a clean source (idempotent)", async () => {
      const cleanContent =
        "Angular is a platform and framework for building single-page client applications. " +
        "It implements core and optional functionality as a set of TypeScript libraries.";

      mockQuery.mockResolvedValue({
        rows: [{ id: "clean-1", content: cleanContent }],
      });

      const result = await service.purgeNoisyChunks("source-1");

      expect(result).toEqual({ purged: 0 });
      // No DELETE query issued
      const deleteSql = mockQuery.mock.calls.find(([sql]) => sql.includes("DELETE FROM chunks"));
      expect(deleteSql).toBeUndefined();
    });

    it("scans all sources when no sourceId is provided", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await service.purgeNoisyChunks();

      const selectCall = mockQuery.mock.calls.find(([sql]) =>
        sql.includes("SELECT id, content FROM chunks"),
      );
      expect(selectCall![0]).not.toContain("WHERE");
    });

    it("filters by sourceId when provided", async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      await service.purgeNoisyChunks("source-42");

      const selectCall = mockQuery.mock.calls.find(([sql]) =>
        sql.includes("SELECT id, content FROM chunks"),
      );
      expect(selectCall![0]).toContain("WHERE source_id");
      expect(selectCall![1]).toEqual(["source-42"]);
    });
  });
});
