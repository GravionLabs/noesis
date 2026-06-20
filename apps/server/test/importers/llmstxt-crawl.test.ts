import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCrawlUrl = vi.hoisted(() => vi.fn());
const mockSaveChunks = vi.hoisted(() => vi.fn());
const mockParseLlmsTxt = vi.hoisted(() => vi.fn());
const mockExtractUrls = vi.hoisted(() => vi.fn());

vi.mock("../../src/crawler/crawler.js", () => ({
  crawlUrl: (...args: unknown[]) => mockCrawlUrl(...args),
}));

vi.mock("../../src/services/chunk-service.js", () => ({
  ChunkService: class {
    constructor() {}
    saveChunks = (...args: unknown[]) => mockSaveChunks(...args);
  },
  saveChunks: (...args: unknown[]) => mockSaveChunks(...args),
}));

vi.mock("../../src/crawler/llmstxt-parser.js", () => ({
  parseLlmsTxt: (...args: unknown[]) => mockParseLlmsTxt(...args),
  extractUrls: (...args: unknown[]) => mockExtractUrls(...args),
}));

vi.mock("../../src/db/pool.js", () => ({
  query: vi.fn(),
  db: {},
  pool: { connect: vi.fn() },
}));

import { LlmsTxtCrawlImporter } from "../../src/importers/llmstxt-crawl.js";

describe("LlmsTxtCrawlImporter", () => {
  let importer: LlmsTxtCrawlImporter;

  beforeEach(() => {
    importer = new LlmsTxtCrawlImporter();
    vi.clearAllMocks();
  });

  it("crawls all URLs from llms.txt and saves chunks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "# Test\n- [Page 1](https://example.com/page1)",
    } as Response);

    mockParseLlmsTxt.mockReturnValue({
      title: "Test",
      description: "",
      importantLinks: [{ url: "https://example.com/page1", label: "Page 1", description: "" }],
      optionalLinks: [],
    });
    mockExtractUrls.mockReturnValue(["https://example.com/page1"]);
    mockCrawlUrl.mockResolvedValue({
      chunks: [
        {
          docUrl: "https://example.com/page1",
          docTitle: "Page 1",
          content: "Page content here with sufficient length.",
          heading: undefined,
          headingPath: [],
          chunkIndex: 0,
        },
      ],
    });
    mockSaveChunks.mockResolvedValue({ docCount: 1, chunkCount: 1 });

    const source = {
      id: "src-1", name: "Test", url: "https://example.com/llms.txt",
      importerType: "llmstxt-crawl", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(1);
    expect(result.chunkCount).toBe(1);
    expect(mockSaveChunks).toHaveBeenCalled();
  });

  it("returns empty when no URLs are found", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "# Empty",
    } as Response);

    mockParseLlmsTxt.mockReturnValue({
      title: "Empty",
      description: "",
      importantLinks: [],
      optionalLinks: [],
    });
    mockExtractUrls.mockReturnValue([]);

    const source = {
      id: "src-2", name: "Empty", url: "https://example.com/empty.txt",
      importerType: "llmstxt-crawl", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(0);
    expect(result.chunkCount).toBe(0);
  });

  it("handles fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const source = {
      id: "src-3", name: "Broken", url: "https://example.com/broken.txt",
      importerType: "llmstxt-crawl", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    await expect(importer.import(source)).rejects.toThrow("500");
  });
});
