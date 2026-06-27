import { describe, it, expect, vi, beforeEach } from "vitest";
import { UrlListImporter } from "../../src/importers/url-list.js";

const mockSaveChunks = vi.fn();
const mockChunkService = { saveChunks: mockSaveChunks };

function block(text: string, n = 5): string {
  return (text + "\n").repeat(n);
}

const pageContent1 = [
  "# Page 1",
  "",
  block("This is the content of page 1 with sufficient text for chunking.", 5),
  "",
  "## Section A",
  "",
  block("More detailed content for section A.", 5),
].join("\n");

const pageContent2 = [
  "# Page 2",
  "",
  block("This is the content of page 2 with sufficient text for chunking.", 5),
].join("\n");

describe("UrlListImporter", () => {
  let importer: UrlListImporter;

  beforeEach(() => {
    mockSaveChunks.mockReset();
    mockSaveChunks.mockResolvedValue({ docCount: 1, chunkCount: 1 });
    importer = new UrlListImporter({ chunkService: mockChunkService });
  });

  it("fetches the URL list, then fetches each URL and chunks the content", async () => {
    const listContent = [
      "https://example.com/page1",
      "https://example.com/page2",
    ].join("\n");

    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce({ ok: true, text: async () => listContent } as Response)
      .mockResolvedValueOnce({ ok: true, text: async () => pageContent1 } as Response)
      .mockResolvedValueOnce({ ok: true, text: async () => pageContent2 } as Response);

    const source = {
      id: "src-1", name: "My Docs", url: "https://example.com/urls.txt",
      importerType: "url-list", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBeGreaterThanOrEqual(1);
    expect(mockSaveChunks).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("handles empty URL list", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => "",
    } as Response);

    const source = {
      id: "src-2", name: "Empty", url: "https://example.com/empty.txt",
      importerType: "url-list", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(0);
    expect(result.chunkCount).toBe(0);
  });

  it("skips comments and blank lines", async () => {
    const listContent = [
      "# This is a comment",
      "",
      "https://example.com/page1",
      "  ",
      "# Another comment",
    ].join("\n");

    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce({ ok: true, text: async () => listContent } as Response)
      .mockResolvedValueOnce({ ok: true, text: async () => pageContent1 } as Response);

    const source = {
      id: "src-3", name: "Comments", url: "https://example.com/list.txt",
      importerType: "url-list", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.chunkCount).toBeGreaterThanOrEqual(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports dropped URLs on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, text: async () => "https://example.com/bad" } as Response)
      .mockRejectedValueOnce(new Error("Network error"));

    const source = {
      id: "src-4", name: "Broken", url: "https://example.com/bad-list.txt",
      importerType: "url-list", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.chunksDropped).toBeDefined();
    expect(result.chunksDropped![0].reason).toBe("fetch_error");
    expect(result.chunksDropped![0].count).toBeGreaterThanOrEqual(1);
  });
});
