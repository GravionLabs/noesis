import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSaveChunks = vi.fn();
const mockChunkService = { saveChunks: mockSaveChunks };

function block(text: string, n = 5): string {
  return (text + "\n").repeat(n);
}

const sampleContent = [
  "# Test Doc",
  "",
  block("This is a test document with sufficient content for chunking.", 5),
  "",
  "## Section 1",
  "",
  block("More content in section 1 to create multiple chunks.", 5),
].join("\n");

const { mockReaddir, mockReadFile } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock("fs", () => ({
  promises: {
    readdir: mockReaddir,
    readFile: mockReadFile,
  },
}));

import { LocalFilesystemImporter } from "../../src/importers/local-filesystem.js";

describe("LocalFilesystemImporter", () => {
  let importer: LocalFilesystemImporter;

  beforeEach(() => {
    mockSaveChunks.mockReset();
    mockSaveChunks.mockResolvedValue({ docCount: 1, chunkCount: 2 });
    mockReaddir.mockReset();
    mockReadFile.mockReset();
    importer = new LocalFilesystemImporter({ chunkService: mockChunkService });
  });

  it("reads .md files from a directory and saves chunks", async () => {
    mockReaddir
      .mockResolvedValueOnce([
        { name: "readme.md", isDirectory: () => false } as any,
        { name: "docs", isDirectory: () => true } as any,
      ])
      .mockResolvedValueOnce([
        { name: "getting-started.md", isDirectory: () => false } as any,
      ]);
    mockReadFile.mockResolvedValue(sampleContent);

    const source = {
      id: "src-1", name: "Local Docs", url: "file:///home/user/project",
      importerType: "local", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBeGreaterThanOrEqual(1);
    expect(mockSaveChunks).toHaveBeenCalled();
  });

  it("handles empty directory", async () => {
    mockReaddir.mockResolvedValue([]);

    const source = {
      id: "src-2", name: "Empty", url: "file:///home/user/empty",
      importerType: "local", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(0);
    expect(result.chunkCount).toBe(0);
  });

  it("skips non-md files and node_modules", async () => {
    mockReaddir.mockResolvedValue([
      { name: "package.json", isDirectory: () => false } as any,
      { name: "index.js", isDirectory: () => false } as any,
      { name: "node_modules", isDirectory: () => true } as any,
    ]);

    const source = {
      id: "src-3", name: "No Docs", url: "file:///home/user/project",
      importerType: "local", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(0);
    expect(mockReadFile).not.toHaveBeenCalled();
  });
});
