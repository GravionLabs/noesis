import { describe, it, expect, vi, beforeEach } from "vitest";
import { GithubImporter } from "../../src/importers/github.js";

const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });

vi.mock("../../src/db/pool.js", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  db: {},
  pool: {},
}));

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
    importer = new GithubImporter();
    mockQuery.mockReset();
  });

  it("downloads, chunks, and stores readme for a valid GitHub repo", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => sampleReadme,
    } as Response);

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "doc-1" }], rowCount: 1 })
      .mockResolvedValue({ rowCount: 1 });

    const source = {
      id: "src-1", name: "test/repo", url: "https://github.com/test/repo",
      importerType: "github", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(1);
    expect(result.chunkCount).toBe(3);
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });

  it("rejects invalid GitHub URLs", async () => {
    const source = {
      id: "src-2", name: "bad", url: "https://example.com/not-github",
      importerType: "github", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    await expect(importer.import(source)).rejects.toThrow("Invalid GitHub URL");
  });

  it("handles fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as Response);

    const source = {
      id: "src-3", name: "private/repo", url: "https://github.com/private/repo",
      importerType: "github", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    await expect(importer.import(source)).rejects.toThrow("403");
  });
});
