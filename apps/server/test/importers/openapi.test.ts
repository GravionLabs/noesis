import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenApiImporter } from "../../src/importers/openapi.js";

const mockClient = vi.hoisted(() => ({
  query: vi.fn().mockResolvedValue({ rows: [{ id: "doc-1" }], rowCount: 1 }),
  release: vi.fn(),
}));

vi.mock("../../src/db/pool.js", () => ({
  query: (...args: unknown[]) => mockClient.query(...args),
  db: {},
  pool: { connect: vi.fn().mockResolvedValue(mockClient) },
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
    mockClient.query.mockClear();
    mockClient.query.mockResolvedValue({ rows: [{ id: "doc-1" }], rowCount: 1 });
    mockClient.release.mockClear();
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

    const source = {
      id: "src-1", name: "My API", url: "https://example.com/openapi.json",
      importerType: "openapi", enabled: true, config: null, schedule: null,
      lastImportedAt: null, createdAt: new Date(), updatedAt: new Date(),
    };

    const result = await importer.import(source);

    expect(result.docCount).toBe(1);
    expect(result.chunkCount).toBe(3);
    expect(mockClient.query).toHaveBeenCalled();
  });

  it("handles specs with no paths", async () => {
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
