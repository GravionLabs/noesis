import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { setupTestDb, truncateAll, teardownTestDb } from "./helpers/db.js";
import { ChunkService } from "../../src/services/chunk-service.js";
import { SourceService } from "../../src/services/source-service.js";
import { EmbeddingService } from "../../src/services/embedding-service.js";
import { SearchService } from "../../src/services/search-service.js";
import type { Database } from "../../src/db/database.js";
import type { Config } from "../../src/config/index.js";

describe("import -> embed -> search (integration)", () => {
  let database: Database;
  let sourceService: SourceService;
  let chunkService: ChunkService;
  let embeddingService: EmbeddingService;
  let searchService: SearchService;

  beforeAll(async () => {
    database = await setupTestDb();
    sourceService = new SourceService({ database });
    chunkService = new ChunkService({ database });
    embeddingService = new EmbeddingService({
      config: {
        EMBEDDING_PROVIDER: "local",
        EMBEDDING_MODEL: "Xenova/all-MiniLM-L6-v2",
      } as Config,
      database,
    });
    searchService = new SearchService({ database, embeddingService });
  }, 30_000);

  afterEach(async () => {
    await truncateAll(database);
  });

  afterAll(async () => {
    await teardownTestDb(database);
  });

  it("seeds chunks, embeds them, and finds them via search", async () => {
    const source = await sourceService.createSource({
      name: "Test Source",
      url: "https://example.com/import-search",
    });
    if (!source) throw new Error("failed to create source");

    await chunkService.saveChunks(
      [
        {
          docUrl: "/getting-started",
          docTitle: "Getting Started",
          content: "Install the noesis CLI using the package manager of your choice.",
          heading: "Installation",
          headingPath: ["Getting Started", "Installation"],
          chunkIndex: 0,
        },
      ],
      source.id,
    );

    const embeddedCount = await embeddingService.embedUnembeddedChunks(source.id);
    expect(embeddedCount).toBe(1);

    const embeddingsRow = await database.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM embeddings",
    );
    expect(embeddingsRow.rows[0].count).toBe(1);

    const results = await searchService.searchDocs("how do I install the CLI?");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({
      docUrl: "/getting-started",
      sourceName: "Test Source",
    });
    expect(typeof results[0].score).toBe("number");
  }, 30_000);
});
