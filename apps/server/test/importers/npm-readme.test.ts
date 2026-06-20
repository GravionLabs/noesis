import { describe, it, expect, vi, beforeEach } from "vitest";
import { NpmReadmeImporter } from "../../src/importers/npm-readme.js";

const mockClient = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({ rows: [{ id: "doc-1" }], rowCount: 1 }),
  release: vi.fn(),
}));

vi.mock("../../src/db/pool.js", () => ({
  query: (...args: unknown[]) => mockClient.query(...args),
  db: {},
  pool: { connect: vi.fn().mockResolvedValue(mockClient) },
}));

function block(text: string, n = 3): string {
  return (text + "\n").repeat(n);
}

const sampleReadme = [
  "# lodash",
  "",
  block("A modern JavaScript utility library delivering modularity, performance & extras.", 5),
  "",
  "## Installation",
  "",
  block("npm install lodash", 5),
  "",
  "## Usage",
  "",
  block("const _ = require('lodash');", 5),
].join("\n");

describe("NpmReadmeImporter", () => {
  let importer: NpmReadmeImporter;

  beforeEach(() => {
    importer = new NpmReadmeImporter();
    mockClient.query.mockClear();
    mockClient.query.mockResolvedValue({ rows: [{ id: "doc-1" }], rowCount: 1 });
    mockClient.release.mockClear();
  });

  it("downloads, chunks, and stores readme for a valid package", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        name: "lodash",
        description: "Lodash modular utilities.",
        readme: sampleReadme,
      }),
    } as Response);

    const source = {
      id: "src-1", name: "lodash", url: "https://www.npmjs.com/package/lodash",
      importerType: "npm-readme", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(1);
    expect(result.chunkCount).toBe(3);
    expect(mockClient.query).toHaveBeenCalled();
  });

  it("returns empty when readme is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: "empty", description: "No readme", readme: "" }),
    } as Response);

    const source = {
      id: "src-2", name: "empty", url: "https://www.npmjs.com/package/empty",
      importerType: "npm-readme", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(0);
    expect(result.chunkCount).toBe(0);
  });

  it("handles fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const source = {
      id: "src-3", name: "missing", url: "https://www.npmjs.com/package/missing",
      importerType: "npm-readme", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    await expect(importer.import(source)).rejects.toThrow("404");
  });
});
