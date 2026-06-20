import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const mockSearchDocs = vi.fn();
const mockGetChunkWithSource = vi.fn();
const mockListSources = vi.fn();
const mockTriggerImport = vi.fn();
const mockGetJob = vi.fn();

vi.mock("../../src/search/search.js", () => ({
  searchDocs: (...args: unknown[]) => mockSearchDocs(...args),
}));

vi.mock("../../src/services/chunk-service.js", () => ({
  getChunkWithSource: (...args: unknown[]) => mockGetChunkWithSource(...args),
}));

vi.mock("../../src/services/source-service.js", () => ({
  listSources: (...args: unknown[]) => mockListSources(...args),
}));

vi.mock("../../src/services/import-service.js", () => ({
  triggerImport: (...args: unknown[]) => mockTriggerImport(...args),
}));

vi.mock("../../src/services/job-service.js", () => ({
  getJob: (...args: unknown[]) => mockGetJob(...args),
}));

import { createMcpServer } from "../../src/mcp/handler.js";

describe("MCP tools", () => {
  let client: Client;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;

  beforeEach(async () => {
    vi.clearAllMocks();
    const server = createMcpServer();
    const pair = InMemoryTransport.createLinkedPair();
    clientTransport = pair[0];
    serverTransport = pair[1];
    client = new Client({ name: "test-client", version: "1.0.0" });
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  afterEach(async () => {
    await client.close();
  });

  describe("search_docs", () => {
    it("returns formatted results", async () => {
      mockSearchDocs.mockResolvedValue([
        {
          sourceName: "test-source",
          docUrl: "https://example.com/doc",
          docTitle: "Test Doc",
          heading: "Introduction",
          content: "Some content here that is long enough to pass the test.",
          score: 0.95,
          chunkId: "chunk-1",
        },
      ]);

      const result = await client.callTool({ name: "search_docs", arguments: { query: "test", limit: 10 } });

      expect(result.content).toBeDefined();
      expect(mockSearchDocs).toHaveBeenCalledWith("test", 10, undefined);
    });

    it("returns no results message for empty results", async () => {
      mockSearchDocs.mockResolvedValue([]);

      const result = await client.callTool({ name: "search_docs", arguments: { query: "nothing", limit: 10 } });

      expect(result.content[0]).toBeDefined();
      expect((result.content[0] as { text: string }).text).toBe("No results found.");
    });

    it("handles errors gracefully", async () => {
      mockSearchDocs.mockRejectedValue(new Error("Search failed"));

      const result = await client.callTool({ name: "search_docs", arguments: { query: "test", limit: 10 } });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("Search failed");
    });
  });

  describe("get_chunk", () => {
    it("returns chunk details when found", async () => {
      mockGetChunkWithSource.mockResolvedValue({
        chunkId: "chunk-1",
        content: "Chunk content here with enough length to be valid.",
        heading: "Section 1",
        headingPath: ["Section 1"],
        chunkIndex: 0,
        docUrl: "https://example.com/doc",
        docTitle: "Test Doc",
        sourceId: "src-1",
        sourceName: "test-source",
      });

      const result = await client.callTool({ name: "get_chunk", arguments: { chunkId: "chunk-1" } });

      expect(result.content).toBeDefined();
      expect(result.isError).toBeFalsy();
      expect(mockGetChunkWithSource).toHaveBeenCalledWith("chunk-1");
    });

    it("returns not found when chunk does not exist", async () => {
      mockGetChunkWithSource.mockResolvedValue(null);

      const result = await client.callTool({ name: "get_chunk", arguments: { chunkId: "missing" } });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("not found");
    });

    it("handles errors gracefully", async () => {
      mockGetChunkWithSource.mockRejectedValue(new Error("DB error"));

      const result = await client.callTool({ name: "get_chunk", arguments: { chunkId: "chunk-1" } });

      expect(result.isError).toBe(true);
    });
  });

  describe("list_sources", () => {
    it("returns sources list", async () => {
      mockListSources.mockResolvedValue([
        {
          id: "src-1",
          name: "Test",
          url: "https://example.com",
          importerType: "llmstxt",
          enabled: true,
          lastImportedAt: null,
        },
      ]);

      const result = await client.callTool({ name: "list_sources", arguments: {} });

      expect(result.content).toBeDefined();
      expect(result.isError).toBeFalsy();
      expect((result.content[0] as { text: string }).text).toContain("src-1");
    });

    it("returns empty message when no sources", async () => {
      mockListSources.mockResolvedValue([]);

      const result = await client.callTool({ name: "list_sources", arguments: {} });

      expect((result.content[0] as { text: string }).text).toBe("No sources registered.");
    });

    it("handles errors gracefully", async () => {
      mockListSources.mockRejectedValue(new Error("DB error"));

      const result = await client.callTool({ name: "list_sources", arguments: {} });

      expect(result.isError).toBe(true);
    });
  });

  describe("import_source", () => {
    it("triggers import and returns job info", async () => {
      mockTriggerImport.mockResolvedValue({ id: "job-1", status: "pending" });

      const result = await client.callTool({ name: "import_source", arguments: { sourceId: "src-1" } });

      expect(result.content).toBeDefined();
      expect(result.isError).toBeFalsy();
      expect(mockTriggerImport).toHaveBeenCalledWith("src-1");
      expect((result.content[0] as { text: string }).text).toContain("job-1");
    });

    it("handles source not found", async () => {
      mockTriggerImport.mockRejectedValue(new Error("Source not found"));

      const result = await client.callTool({ name: "import_source", arguments: { sourceId: "missing" } });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("Import failed");
    });
  });

  describe("get_job_status", () => {
    it("returns job details when found", async () => {
      mockGetJob.mockResolvedValue({
        id: "job-1",
        type: "import",
        sourceId: "src-1",
        status: "done",
        error: null,
        startedAt: new Date("2026-01-01T00:00:00Z"),
        finishedAt: new Date("2026-01-01T00:01:00Z"),
        createdAt: new Date("2026-01-01T00:00:00Z"),
      });

      const result = await client.callTool({ name: "get_job_status", arguments: { jobId: "job-1" } });

      expect(result.content).toBeDefined();
      expect(result.isError).toBeFalsy();
      expect(mockGetJob).toHaveBeenCalledWith("job-1");
      expect((result.content[0] as { text: string }).text).toContain("done");
    });

    it("returns not found when job does not exist", async () => {
      mockGetJob.mockResolvedValue(null);

      const result = await client.callTool({ name: "get_job_status", arguments: { jobId: "missing" } });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain("not found");
    });

    it("handles errors gracefully", async () => {
      mockGetJob.mockRejectedValue(new Error("DB error"));

      const result = await client.callTool({ name: "get_job_status", arguments: { jobId: "job-1" } });

      expect(result.isError).toBe(true);
    });
  });
});
