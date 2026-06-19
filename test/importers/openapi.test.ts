import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenApiImporter } from "../../src/importers/openapi.js";

const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });

vi.mock("../../src/db/pool.js", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  db: {},
  pool: {},
}));

function makeSpec(paths: Record<string, unknown> = {}) {
  return {
    info: { title: "Test API", description: "A test API spec" },
    paths,
  };
}

describe("OpenApiImporter", () => {
  let importer: OpenApiImporter;

  beforeEach(() => {
    importer = new OpenApiImporter();
    mockQuery.mockReset();
  });

  it("creates chunks for each operation in a spec", async () => {
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

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "doc-1" }], rowCount: 1 })
      .mockResolvedValue({ rowCount: 1 });

    const source = {
      id: "src-1", name: "My API", url: "https://example.com/openapi.json",
      importerType: "openapi", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(1);
    expect(result.chunkCount).toBe(3);
    expect(mockQuery).toHaveBeenCalledTimes(4);
  });

  it("handles specs with no paths", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => makeSpec({}),
    } as Response);

    mockQuery.mockResolvedValueOnce({ rows: [{ id: "doc-1" }], rowCount: 1 });

    const source = {
      id: "src-1", name: "Empty", url: "https://example.com/empty-spec.json",
      importerType: "openapi", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(1);
    expect(result.chunkCount).toBe(0);
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
