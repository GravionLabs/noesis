import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { setupTestDb, truncateAll, teardownTestDb } from "./helpers/db.js";
import { SourceService } from "../../src/services/source-service.js";
import type { Database } from "../../src/db/database.js";

describe("SourceService (integration)", () => {
  let database: Database;
  let sourceService: SourceService;

  beforeAll(async () => {
    database = await setupTestDb();
    sourceService = new SourceService({ database });
  });

  afterEach(async () => {
    await truncateAll(database);
  });

  afterAll(async () => {
    await teardownTestDb(database);
  });

  it("creates a source and lists it", async () => {
    const created = await sourceService.createSource({
      name: "Docs",
      url: "https://example.com/a",
    });

    expect(created?.name).toBe("Docs");
    expect(created?.enabled).toBe(true);

    const all = await sourceService.listSources();
    expect(all).toHaveLength(1);
    expect(all[0].url).toBe("https://example.com/a");
  });

  it("returns null instead of creating a duplicate by url", async () => {
    await sourceService.createSource({ name: "Docs", url: "https://example.com/a" });

    const duplicate = await sourceService.createSource({
      name: "Docs again",
      url: "https://example.com/a",
    });

    expect(duplicate).toBeNull();
    const all = await sourceService.listSources();
    expect(all).toHaveLength(1);
  });

  it("enforces the unique url index at the database level", async () => {
    const first = await sourceService.createSource({ name: "Docs", url: "https://example.com/a" });
    expect(first).toBeTruthy();

    await expect(
      database.query(
        "INSERT INTO sources (name, url) VALUES ($1, $2)",
        ["Docs dup", "https://example.com/a"],
      ),
    ).rejects.toThrow();
  });

  it("gets a source by id", async () => {
    const created = await sourceService.createSource({ name: "Docs", url: "https://example.com/a" });

    const found = await sourceService.getSource(created!.id);

    expect(found?.id).toBe(created!.id);
  });

  it("updates fields on a source", async () => {
    const created = await sourceService.createSource({ name: "Docs", url: "https://example.com/a" });

    const updated = await sourceService.updateSource(created!.id, { name: "New Name", enabled: false });

    expect(updated?.name).toBe("New Name");
    expect(updated?.enabled).toBe(false);
  });

  it("updates lastImportedAt", async () => {
    const created = await sourceService.createSource({ name: "Docs", url: "https://example.com/a" });
    expect(created?.lastImportedAt).toBeNull();

    await sourceService.updateLastImported(created!.id);

    const found = await sourceService.getSource(created!.id);
    expect(found?.lastImportedAt).toBeTruthy();
  });

  it("deletes a source", async () => {
    const created = await sourceService.createSource({ name: "Docs", url: "https://example.com/a" });

    const deleted = await sourceService.deleteSource(created!.id);

    expect(deleted?.id).toBe(created!.id);
    expect(await sourceService.getSource(created!.id)).toBeNull();
  });

  it("counts total sources", async () => {
    await sourceService.createSource({ name: "A", url: "https://example.com/a" });
    await sourceService.createSource({ name: "B", url: "https://example.com/b" });

    const count = await sourceService.getTotalSourceCount();

    expect(count).toBe(2);
  });
});
