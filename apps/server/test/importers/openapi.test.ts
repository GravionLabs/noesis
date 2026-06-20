import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenApiImporter } from "../../src/importers/openapi.js";

const mockSaveChunks = vi.fn();

const mockChunkService = { saveChunks: mockSaveChunks } as any;

function makeSpec(paths: Record<string, unknown> = {}) {
  return {
    info: { title: "Test API", description: "A test API spec" },
    paths,
  };
}

describe("OpenApiImporter", () => {
  let importer: OpenApiImporter;

  beforeEach(() => {
    mockSaveChunks.mockReset();
    mockSaveChunks.mockResolvedValue({ docCount: 1, chunkCount: 0 });
    importer = new OpenApiImporter({ chunkService: mockChunkService });
  });

  it("creates chunks for each operation in a spec", async () => {
    mockSaveChunks.mockResolvedValue({ docCount: 1, chunkCount: 4 });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeSpec({
          "/users": {
            get: { summary: "List users", operationId: "listUsers", tags: ["Users"] },
            post: { summary: "Create user", operationId: "createUser", tags: ["Users"] },
          },
          "/users/{id}": {
            get: {
              summary: "Get user by ID",
              description: "Returns a single user",
              tags: ["Users"],
            },
          },
        }),
    } as Response);

    const source = {
      id: "src-1", name: "My API", url: "https://example.com/openapi.json",
      importerType: "openapi", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(1);
    expect(result.chunkCount).toBe(4);
    expect(mockSaveChunks).toHaveBeenCalled();
  });

  it("handles specs with no paths", async () => {
    mockSaveChunks.mockResolvedValue({ docCount: 1, chunkCount: 1 });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => makeSpec({}),
    } as Response);

    const source = {
      id: "src-1", name: "Empty", url: "https://example.com/empty-spec.json",
      importerType: "openapi", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(1);
    expect(result.chunkCount).toBe(1);
    expect(mockSaveChunks).toHaveBeenCalled();
  });

  it("handles fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    const source = {
      id: "src-2", name: "Broken", url: "https://example.com/missing.json",
      importerType: "openapi", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    await expect(importer.import(source)).rejects.toThrow("404");
  });
});
