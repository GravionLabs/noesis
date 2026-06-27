import { describe, it, expect, vi, beforeEach } from "vitest";
import { GithubImporter } from "../../src/importers/github.js";

const mockSaveChunks = vi.fn();
const mockProvider = {
  canHandle: vi.fn().mockReturnValue(true),
  getReadme: vi.fn(),
  getDocFiles: vi.fn().mockResolvedValue([]),
  getFile: vi.fn(),
};

const mockChunkService = { saveChunks: mockSaveChunks };

function block(text: string, n = 3): string {
  return (text + "\n").repeat(n);
}

const sampleReadme = [
  "# test/repo",
  "",
  block("This is the README for test/repo with sufficient content.", 5),
  "",
  "## Installation",
  "",
  block("Run npm install to get started with this amazing project.", 5),
  "",
  "## API",
  "",
  block("The API docs explain all available endpoints and usage patterns.", 5),
].join("\n");

describe("GithubImporter", () => {
  let importer: GithubImporter;

  beforeEach(() => {
    importer = new GithubImporter({ chunkService: mockChunkService, provider: mockProvider as any });
    mockSaveChunks.mockReset();
    mockSaveChunks.mockResolvedValue({ docCount: 1, chunkCount: 3 });
    vi.clearAllMocks();
    mockProvider.canHandle.mockReturnValue(true);
    mockProvider.getDocFiles.mockResolvedValue([]);
    mockProvider.getReadme.mockReset();
    mockProvider.getFile.mockReset();
  });

  it("downloads, chunks, and stores readme for a valid GitHub repo", async () => {
    mockProvider.getReadme.mockResolvedValue({ path: "README.md", content: sampleReadme });
    mockSaveChunks.mockResolvedValue({ docCount: 1, chunkCount: 3 });

    const source = {
      id: "src-1", name: "test/repo", url: "https://github.com/test/repo",
      importerType: "github", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(1);
    expect(result.chunkCount).toBe(3);
    expect(mockProvider.getReadme).toHaveBeenCalled();
  });

  it("rejects invalid GitHub URLs", async () => {
    mockProvider.canHandle.mockReturnValue(false);

    const source = {
      id: "src-2", name: "bad", url: "https://example.com/not-github",
      importerType: "github", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    await expect(importer.import(source)).rejects.toThrow("Invalid GitHub URL");
  });

  it("imports docs/ folder files when present", async () => {
    mockProvider.getReadme.mockResolvedValue(null);
    mockProvider.getDocFiles.mockResolvedValue([
      { path: "docs/getting-started.md", isDirectory: false },
      { path: "docs/advanced.md", isDirectory: false },
    ]);
    mockProvider.getFile
      .mockResolvedValueOnce({ path: "docs/getting-started.md", content: "# Getting Started\n\nHello world.\n\nMore content here.\n" })
      .mockResolvedValueOnce({ path: "docs/advanced.md", content: "# Advanced\n\nDeep dive.\n\nMore details.\n" });

    const source = {
      id: "src-3", name: "test/repo", url: "https://github.com/test/repo",
      importerType: "github", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(mockProvider.getDocFiles).toHaveBeenCalled();
    expect(mockProvider.getFile).toHaveBeenCalledTimes(2);
    expect(result.docCount).toBeGreaterThanOrEqual(0);
  });

  it("returns empty result when readme and docs are both unavailable", async () => {
    mockProvider.getReadme.mockResolvedValue(null);
    mockProvider.getDocFiles.mockResolvedValue([]);

    const source = {
      id: "src-4", name: "empty/repo", url: "https://github.com/empty/repo",
      importerType: "github", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(0);
    expect(result.chunkCount).toBe(0);
  });
});
