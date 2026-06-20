import { describe, it, expect, vi, beforeEach } from "vitest";
import { LlmsTxtImporter } from "../../src/importers/llmstxt.js";

const mockSaveChunks = vi.fn();

const mockChunkService = { saveChunks: mockSaveChunks } as any;

function block(text: string, n = 3): string {
  return (text + "\n").repeat(n);
}

const sampleText = [
  "# Test Docs",
  "",
  block("This is a sample documentation page with enough text to exceed 50 characters.", 5),
  "",
  "## Getting Started",
  "",
  block("Run npm start to begin. This is a long enough content block to be captured as a chunk.", 5),
  "",
  "## API Reference",
  "",
  block("See the API docs for details. This content block is long enough to be captured.", 5),
].join("\n");

describe("LlmsTxtImporter", () => {
  let importer: LlmsTxtImporter;

  beforeEach(() => {
    mockSaveChunks.mockReset();
    mockSaveChunks.mockImplementation((chunks: any[]) =>
      chunks.length === 0
        ? { docCount: 0, chunkCount: 0 }
        : { docCount: 1, chunkCount: chunks.length },
    );
    importer = new LlmsTxtImporter({ chunkService: mockChunkService });
  });

  it("downloads, chunks, and stores docs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => sampleText,
    } as Response);

    const source = {
      id: "src-1",
      name: "Test",
      url: "https://example.com/llms-full.txt",
      importerType: "llmstxt",
      enabled: true,
      config: null,
      schedule: null,
      lastImportedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(1);
    expect(result.chunkCount).toBe(3);
    expect(mockSaveChunks).toHaveBeenCalled();
  });

  it("handles fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const source = {
      id: "src-2",
      name: "Broken",
      url: "https://example.com/missing",
      importerType: "llmstxt",
      enabled: true,
      config: null,
      schedule: null,
      lastImportedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await expect(importer.import(source)).rejects.toThrow("404");
  });

  it("returns empty result for empty content", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "",
    } as Response);

    const source = {
      id: "src-3",
      name: "Empty",
      url: "https://example.com/empty",
      importerType: "llmstxt",
      enabled: true,
      config: null,
      schedule: null,
      lastImportedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await importer.import(source);
    expect(result.docCount).toBe(0);
    expect(result.chunkCount).toBe(0);
  });
});
