import { describe, it, expect, vi, beforeEach } from "vitest";
import * as crawler from "../../src/crawler/crawler.js";
import * as parser from "../../src/crawler/llmstxt-parser.js";

const mockSaveChunks = vi.fn();

const mockChunkService = { saveChunks: mockSaveChunks } as any;

import { LlmsTxtCrawlImporter } from "../../src/importers/llmstxt-crawl.js";

describe("LlmsTxtCrawlImporter", () => {
  let importer: LlmsTxtCrawlImporter;

  beforeEach(() => {
    mockSaveChunks.mockReset();
    importer = new LlmsTxtCrawlImporter({ chunkService: mockChunkService });
  });

  it("crawls all URLs from llms.txt and saves chunks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "# Test\n- [Page 1](https://example.com/page1)",
    } as Response);

    vi.spyOn(parser, "parseLlmsTxt").mockReturnValue({
      title: "Test",
      description: "",
      importantLinks: [{ url: "https://example.com/page1", label: "Page 1", description: "" }],
      optionalLinks: [],
    } as any);
    vi.spyOn(parser, "extractUrls").mockReturnValue(["https://example.com/page1"]);
    vi.spyOn(crawler, "crawlUrl").mockResolvedValue({
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
    } as any);
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

    vi.spyOn(parser, "parseLlmsTxt").mockReturnValue({
      title: "Empty",
      description: "",
      importantLinks: [],
      optionalLinks: [],
    } as any);
    vi.spyOn(parser, "extractUrls").mockReturnValue([]);

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
