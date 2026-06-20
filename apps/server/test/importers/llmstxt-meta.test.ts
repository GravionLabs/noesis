import { describe, it, expect, vi, beforeEach } from "vitest";
import { LlmsMetaTxtImporter } from "../../src/importers/llmstxt-meta.js";

const mockGetSourceByUrl = vi.fn();
const mockCreateSource = vi.fn();

const mockSourceService = {
  getSourceByUrl: mockGetSourceByUrl,
  createSource: mockCreateSource,
} as any;

const sampleTxt = [
  "# Test Docs",
  "> A collection of documentation for testing.",
  "",
  "- [Getting Started](https://example.com/getting-started)",
  "- [API Reference](https://example.com/api)",
  "",
  "## Optional",
  "- [Advanced Guide](https://example.com/advanced)",
].join("\n");

describe("LlmsMetaTxtImporter", () => {
  let importer: LlmsMetaTxtImporter;

  beforeEach(() => {
    vi.clearAllMocks();
    importer = new LlmsMetaTxtImporter({ sourceService: mockSourceService });
  });

  it("parses llms.txt and updates source config with metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => sampleTxt,
    } as Response);

    const source = {
      id: "src-1", name: "Test", url: "https://example.com/llms.txt",
      importerType: "llmstxt-meta", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(0);
    expect(result.chunkCount).toBe(3);
    expect(mockCreateSource).toHaveBeenCalledTimes(3);
  });

  it("handles fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const source = {
      id: "src-2", name: "Missing", url: "https://example.com/missing.txt",
      importerType: "llmstxt-meta", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    await expect(importer.import(source)).rejects.toThrow("404");
  });
});
