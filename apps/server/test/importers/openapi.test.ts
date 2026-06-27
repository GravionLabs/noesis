import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenApiImporter } from "../../src/importers/openapi.js";

const mockSaveChunks = vi.fn();
const mockChunkService = { saveChunks: mockSaveChunks };

function makeSpec(paths: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return {
    info: { title: "Test API", description: "A test API spec" },
    paths,
    ...extra,
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

  it("includes parameters, request body, and responses in operation chunks", async () => {
    mockSaveChunks.mockResolvedValue({ docCount: 1, chunkCount: 1 });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeSpec({
          "/pets": {
            post: {
              summary: "Create a pet",
              operationId: "createPet",
              tags: ["Pets"],
              parameters: [
                { name: "X-Request-Id", in: "header", description: "Request tracing ID", required: false, schema: { type: "string" } },
              ],
              requestBody: {
                description: "Pet object",
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Pet name" },
                        species: { type: "string", enum: ["cat", "dog"] },
                      },
                      required: ["name"],
                    },
                  },
                },
              },
              responses: {
                "201": { description: "Created" },
                "400": { description: "Bad request", content: { "application/json": { schema: { type: "object", properties: { error: { type: "string" } } } } } },
              },
            },
          },
        }),
    } as Response);

    const source = {
      id: "src-2", name: "Pets API", url: "https://example.com/pets.json",
      importerType: "openapi", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.chunkCount).toBe(1);
    expect(mockSaveChunks).toHaveBeenCalled();
  });

  it("emits schema chunks from components/schemas", async () => {
    mockSaveChunks.mockResolvedValue({ docCount: 1, chunkCount: 3 });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeSpec(
          {
            "/pets/{petId}": {
              get: {
                summary: "Get pet by ID",
                operationId: "getPet",
                tags: ["Pets"],
              },
            },
          },
          {
            components: {
              schemas: {
                Pet: {
                  type: "object",
                  description: "A pet in the store",
                  properties: {
                    id: { type: "integer", description: "Unique ID" },
                    name: { type: "string" },
                    tag: { type: "string" },
                  },
                  required: ["id", "name"],
                },
                Error: {
                  type: "object",
                  properties: {
                    code: { type: "integer" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
        ),
    } as Response);

    const source = {
      id: "src-3", name: "Pets API", url: "https://example.com/pets.json",
      importerType: "openapi", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.chunkCount).toBe(3);
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
      id: "src-4", name: "YAML API", url: "https://example.com/openapi.yaml",
      importerType: "openapi", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.chunkCount).toBe(2);
    expect(mockSaveChunks).toHaveBeenCalled();
  });

  it("handles specs with no paths", async () => {
    mockSaveChunks.mockResolvedValue({ docCount: 1, chunkCount: 1 });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => makeSpec({}),
    } as Response);

    const source = {
      id: "src-5", name: "Empty", url: "https://example.com/empty-spec.json",
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
      id: "src-6", name: "Broken", url: "https://example.com/missing.json",
      importerType: "openapi", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    await expect(importer.import(source)).rejects.toThrow("404");
  });
});
