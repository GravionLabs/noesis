import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDbUpdate = vi.fn();

vi.mock("../../src/db/pool.js", () => ({
  db: { update: (...args: unknown[]) => mockDbUpdate(...args) },
  query: vi.fn(),
  pool: {},
}));

import { LlmsMetaTxtImporter } from "../../src/importers/llmstxt-meta.js";

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
    importer = new LlmsMetaTxtImporter();
    vi.clearAllMocks();
  });

  it("parses llms.txt and updates source config with metadata", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => sampleTxt,
    } as Response);

    const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    mockDbUpdate.mockReturnValue({ set: setMock });

    const source = {
      id: "src-1", name: "Test", url: "https://example.com/llms.txt",
      importerType: "llmstxt-meta", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(0);
    expect(result.chunkCount).toBe(0);
    expect(mockDbUpdate).toHaveBeenCalled();
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
