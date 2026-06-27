import { describe, it, expect, vi, beforeEach } from "vitest";

import { ChunkService } from "../../src/services/chunk-service.js";
import type { CrawlChunkData } from "../../src/services/chunk-service.js";

// Chainable mock for database.db — chain methods return mockDb itself;
// terminal methods resolve with values configured per-test via mockDb._selectResult
// and mockDb._returningResult.
const mockDb: any = {
  _selectResult: [] as any[],
  _returningResult: [] as any[],

  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  innerJoin: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  onConflictDoUpdate: vi.fn(),
  onConflictDoNothing: vi.fn(),
  returning: vi.fn(),
  delete: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
};

function resetMockDb() {
  mockDb._selectResult = [];
  mockDb._returningResult = [];

  // Chain methods — all return mockDb so the fluent chain stays intact
  for (const m of ["select", "from", "where", "orderBy", "innerJoin", "insert", "values", "onConflictDoUpdate", "delete"]) {
    mockDb[m].mockReset();
    mockDb[m].mockReturnValue(mockDb);
  }

  // Terminal methods
  mockDb.limit.mockReset();
  mockDb.limit.mockImplementation(() => Promise.resolve(mockDb._selectResult));

  mockDb.returning.mockReset();
  mockDb.returning.mockImplementation(() => Promise.resolve(mockDb._returningResult));

  mockDb.onConflictDoNothing.mockReset();
  mockDb.onConflictDoNothing.mockResolvedValue(undefined);

  mockDb.execute.mockReset();
  mockDb.execute.mockImplementation(() => Promise.resolve({ rows: mockDb._selectResult }));

  // Transaction — invoke callback with mockDb as the transaction context
  mockDb.transaction.mockReset();
  mockDb.transaction.mockImplementation(async (cb: (tx: any) => any) => cb(mockDb));
}

// Make mockDb itself awaitable so `await db.select().from()` resolves correctly
Object.defineProperty(mockDb, "then", {
  get() {
    return (resolve: any, reject: any) =>
      Promise.resolve(mockDb._selectResult).then(resolve, reject);
  },
  configurable: true,
});

function createService() {
  return new ChunkService({ database: { db: mockDb } as any });
}

describe("ChunkService", () => {
  let service: ChunkService;

  beforeEach(() => {
    resetMockDb();
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
      mockDb._selectResult = [row];

      const result = await service.getChunkWithSource("chunk-1");

      expect(result).toEqual(row);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.innerJoin).toHaveBeenCalledTimes(2);
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it("returns null when no chunk matches", async () => {
      mockDb._selectResult = [];

      const result = await service.getChunkWithSource("missing-id");

      expect(result).toBeNull();
    });
  });

  describe("getChunksByDocId", () => {
    it("returns rows ordered by chunk_index", async () => {
      const rows = [{ id: "c1" }, { id: "c2" }];
      mockDb._selectResult = rows;

      const result = await service.getChunksByDocId("doc-1");

      expect(result).toEqual(rows);
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
    });
  });

  describe("getChunksBySourceId", () => {
    it("returns rows ordered by created_at desc", async () => {
      const rows = [{ id: "c1" }];
      mockDb._selectResult = rows;

      const result = await service.getChunksBySourceId("source-1");

      expect(result).toEqual(rows);
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
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
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it("inserts docs and chunks within a transaction and returns correct counts", async () => {
      mockDb._returningResult = [{ id: "doc-1" }];

      const result = await service.saveChunks([baseChunk], "source-1");

      expect(result).toEqual({ docCount: 1, chunkCount: 1 });
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalled();
      expect(mockDb.onConflictDoNothing).toHaveBeenCalled();
    });

    it("includes contentMd in doc values when docContentMd is provided", async () => {
      mockDb._returningResult = [{ id: "doc-1" }];

      await service.saveChunks(
        [{ ...baseChunk, docContentMd: "# Doc Title\n\nhello" }],
        "source-1",
      );

      // The first values() call is for the doc upsert
      const firstValuesArg = mockDb.values.mock.calls[0][0] as Record<string, unknown>;
      expect(firstValuesArg).toHaveProperty("contentMd", "# Doc Title\n\nhello");
    });

    it("counts each distinct docUrl once across multiple chunks", async () => {
      mockDb._returningResult = [{ id: "doc-1" }];

      const twoChunks: CrawlChunkData[] = [
        { ...baseChunk, chunkIndex: 0 },
        { ...baseChunk, chunkIndex: 1 },
      ];

      const result = await service.saveChunks(twoChunks, "source-1");

      expect(result).toEqual({ docCount: 1, chunkCount: 2 });
    });

    it("rethrows errors from the transaction callback", async () => {
      mockDb.returning.mockRejectedValueOnce(new Error("db failure"));

      await expect(service.saveChunks([baseChunk], "source-1")).rejects.toThrow(
        "db failure",
      );
    });
  });

  describe("getDocHashes", () => {
    it("returns a map of url → contentHash for the given source", async () => {
      mockDb._selectResult = [
        { url: "https://example.com/page1", contentHash: "abc123" },
        { url: "https://example.com/page2", contentHash: "def456" },
        { url: "https://example.com/page3", contentHash: null as any },
      ];

      const result = await service.getDocHashes("source-1");

      expect(result.size).toBe(2);
      expect(result.get("https://example.com/page1")).toBe("abc123");
      expect(result.get("https://example.com/page2")).toBe("def456");
      expect(result.has("https://example.com/page3")).toBe(false);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it("returns an empty map when source has no docs", async () => {
      mockDb._selectResult = [];

      const result = await service.getDocHashes("source-empty");

      expect(result.size).toBe(0);
    });
  });

  describe("purgeNoisyChunks", () => {
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

    it("deletes chunks classified as link-list noise and returns purged count", async () => {
      mockDb._selectResult = [
        { id: "noisy-1", content: noisyContent },
        { id: "clean-1", content: cleanContent },
        { id: "noisy-2", content: noisyContent },
      ];

      const result = await service.purgeNoisyChunks("source-1");

      expect(result).toEqual({ purged: 2 });
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it("returns { purged: 0 } for a clean source (idempotent)", async () => {
      mockDb._selectResult = [{ id: "clean-1", content: cleanContent }];

      const result = await service.purgeNoisyChunks("source-1");

      expect(result).toEqual({ purged: 0 });
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("scans all sources when no sourceId is provided", async () => {
      mockDb._selectResult = [];

      await service.purgeNoisyChunks();

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalled();
    });

    it("filters by sourceId when provided", async () => {
      mockDb._selectResult = [];

      await service.purgeNoisyChunks("source-42");

      expect(mockDb.where).toHaveBeenCalled();
    });
  });
});
