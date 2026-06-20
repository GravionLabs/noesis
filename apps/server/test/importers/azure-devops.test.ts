import { describe, it, expect, vi, beforeEach } from "vitest";
import { AzureDevopsImporter } from "../../src/importers/azure-devops.js";

const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });

vi.mock("../../src/db/pool.js", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

const mockCanHandle = vi.fn();
const mockGetReadme = vi.fn();
const mockGetDocFiles = vi.fn();
const mockGetFile = vi.fn();

vi.mock("../../src/crawler/providers/azure-devops-provider.js", () => ({
  AzureDevOpsProvider: vi.fn().mockImplementation(() => ({
    canHandle: mockCanHandle,
    getReadme: mockGetReadme,
    getDocFiles: mockGetDocFiles,
    getFile: mockGetFile,
  })),
}));

const repoUrl = "https://dev.azure.com/myorg/myproject/_git/myrepo";

function block(text: string, n = 3): string {
  return (text + "\n").repeat(n);
}

describe("AzureDevopsImporter", () => {
  let importer: AzureDevopsImporter;

  beforeEach(() => {
    importer = new AzureDevopsImporter();
    mockQuery.mockReset();
    mockCanHandle.mockReset();
    mockGetReadme.mockReset();
    mockGetDocFiles.mockReset();
    mockGetFile.mockReset();
  });

  it("rejects non-Azure-DevOps URLs", async () => {
    mockCanHandle.mockReturnValue(false);

    const source = {
      id: "src-1",
      name: "Bad",
      url: "https://example.com",
      importerType: "azuredevops",
      enabled: true,
      config: null,
      schedule: null,
      lastImportedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await expect(importer.import(source)).rejects.toThrow("requires a dev.azure.com URL");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("imports README only when no doc files exist", async () => {
    mockCanHandle.mockReturnValue(true);
    mockGetReadme.mockResolvedValue({
      path: "README.md",
      content: `# My Repo\n\n${block("Content for the README that is long enough to exceed the minimum threshold.", 5)}`,
    });
    mockGetDocFiles.mockResolvedValue([]);

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "doc-1" }], rowCount: 1 })
      .mockResolvedValue({ rowCount: 1 });

    const source = {
      id: "src-1",
      name: "My Repo",
      url: repoUrl,
      importerType: "azuredevops",
      enabled: true,
      config: null,
      schedule: null,
      lastImportedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(1);
    expect(result.chunkCount).toBeGreaterThan(0);
    expect(mockGetReadme).toHaveBeenCalledWith(repoUrl);
  });

  it("imports README and doc files", async () => {
    const readmeContent = `# My Repo\n\n${block("README content.", 5)}`;
    const docContent = `# Getting Started\n\n${block("Getting started content.", 5)}`;

    mockCanHandle.mockReturnValue(true);
    mockGetReadme.mockResolvedValue({ path: "README.md", content: readmeContent });
    mockGetDocFiles.mockResolvedValue([{ path: "/docs/getting-started.md", isDirectory: false }]);
    mockGetFile.mockResolvedValue({ path: "/docs/getting-started.md", content: docContent });

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "doc-1" }], rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: "doc-2" }], rowCount: 1 })
      .mockResolvedValue({ rowCount: 1 });

    const source = {
      id: "src-1",
      name: "My Repo",
      url: repoUrl,
      importerType: "azuredevops",
      enabled: true,
      config: null,
      schedule: null,
      lastImportedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(2);
    expect(result.chunkCount).toBeGreaterThan(0);
    expect(mockGetReadme).toHaveBeenCalledWith(repoUrl);
    expect(mockGetDocFiles).toHaveBeenCalledWith(repoUrl);
  });

  it("handles doc file fetch failure gracefully", async () => {
    mockCanHandle.mockReturnValue(true);
    mockGetReadme.mockResolvedValue(null);
    mockGetDocFiles.mockResolvedValue([{ path: "/docs/broken.md", isDirectory: false }]);
    mockGetFile.mockRejectedValue(new Error("API error"));

    const source = {
      id: "src-1",
      name: "My Repo",
      url: repoUrl,
      importerType: "azuredevops",
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

  it("returns empty result when no content found", async () => {
    mockCanHandle.mockReturnValue(true);
    mockGetReadme.mockResolvedValue(null);
    mockGetDocFiles.mockResolvedValue([]);

    const source = {
      id: "src-1",
      name: "Empty",
      url: repoUrl,
      importerType: "azuredevops",
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
