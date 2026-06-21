import { Database } from "../../../src/db/database.js";
import { runMigrations } from "../../../src/db/migrations.js";
import type { Config } from "../../../src/config/index.js";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://noesis:noesis_dev@localhost:5443/noesis_test";

export async function setupTestDb(): Promise<Database> {
  const database = new Database({
    config: { DATABASE_URL } as Config,
  });
  await runMigrations(database.pool);
  return database;
}

export async function truncateAll(database: Database): Promise<void> {
  await database.query(
    "TRUNCATE sources, docs, chunks, embeddings, jobs RESTART IDENTITY CASCADE",
  );
}

export async function teardownTestDb(database: Database): Promise<void> {
  await database.end();
}
