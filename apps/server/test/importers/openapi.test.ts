import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenApiImporter } from "../../src/importers/openapi.js";

const mockSaveChunks = vi.fn();
const mockChunkService = { saveChunks: mockSaveChunks };

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

  it("creates chunks for each operation in a JSON spec", async () => {
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

  it("handles YAML specs (.yaml extension)", async () => {
    mockSaveChunks.mockResolvedValue({ docCount: 1, chunkCount: 2 });
    const yamlContent = `openapi: "3.0.0"
info:
  title: YAML API
  description: A YAML spec
paths:
  /items:
    get:
      summary: List items
      operationId: listItems
      tags: [Items]
`;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => yamlContent,
      json: async () => { throw new Error("Not JSON"); },
    } as any);

    const source = {
      id: "src-2", name: "YAML API", url: "https://example.com/openapi.yaml",
      importerType: "openapi", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.chunkCount).toBe(2);
    expect(mockSaveChunks).toHaveBeenCalled();
  });

  it("handles YAML specs (.yml extension)", async () => {
    mockSaveChunks.mockResolvedValue({ docCount: 1, chunkCount: 1 });
    const yamlContent = `openapi: "3.0.0"
info:
  title: YML API
paths: {}
`;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => yamlContent,
      json: async () => { throw new Error("Not JSON"); },
    } as any);

    const source = {
      id: "src-3", name: "YML API", url: "https://example.com/spec.yml",
      importerType: "openapi", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(mockSaveChunks).toHaveBeenCalled();
  });

  it("handles specs with no paths", async () => {
    mockSaveChunks.mockResolvedValue({ docCount: 1, chunkCount: 1 });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => makeSpec({}),
    } as Response);

    const source = {
      id: "src-4", name: "Empty", url: "https://example.com/empty-spec.json",
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
      id: "src-5", name: "Broken", url: "https://example.com/missing.json",
      importerType: "openapi", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    await expect(importer.import(source)).rejects.toThrow("404");
  });
});
