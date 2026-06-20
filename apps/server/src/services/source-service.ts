import { db, query } from "../db/pool.js";
import { sources } from "../db/schema.js";
import { eq } from "drizzle-orm";

export interface CreateSourceInput {
  name: string;
  url: string;
  importerType?: string;
  config?: string;
  schedule?: string;
}

export async function listSources() {
  return db.select().from(sources).orderBy(sources.name);
}

export async function getSource(id: string) {
  const rows = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getSourceByUrl(url: string) {
  const rows = await db.select().from(sources).where(eq(sources.url, url)).limit(1);
  return rows[0] ?? null;
}

export async function createSource(input: CreateSourceInput) {
  const existing = await getSourceByUrl(input.url);
  if (existing) return null;

  const rows = await db
    .insert(sources)
    .values({
      name: input.name,
      url: input.url,
      importerType: input.importerType ?? "llmstxt",
      config: input.config ?? null,
      schedule: input.schedule ?? null,
    })
    .returning();
  return rows[0];
}

export async function deleteSource(id: string) {
  const rows = await db.delete(sources).where(eq(sources.id, id)).returning();
  return rows[0] ?? null;
}

export interface UpdateSourceInput {
  name?: string;
  url?: string;
  importerType?: string;
  enabled?: boolean;
  config?: string | null;
  schedule?: string | null;
}

export async function updateSource(id: string, input: UpdateSourceInput) {
  const rows = await db
    .update(sources)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(sources.id, id))
    .returning();
  return rows[0] ?? null;
}

export async function updateLastImported(sourceId: string) {
  await db
    .update(sources)
    .set({ lastImportedAt: new Date(), updatedAt: new Date() })
    .where(eq(sources.id, sourceId));
}

export async function getSourceStats(sourceId: string) {
  const result = await query<{
    docCount: number;
    chunkCount: number;
    avgTokenCount: number | null;
    latestJobStatus: string | null;
    latestJobDurationMs: number | null;
  }>(
    `SELECT
      (SELECT COUNT(*)::int FROM docs WHERE source_id = $1) AS "docCount",
      (SELECT COUNT(*)::int FROM chunks WHERE source_id = $1) AS "chunkCount",
      (SELECT ROUND(AVG(token_count))::int FROM chunks WHERE source_id = $1) AS "avgTokenCount",
      (SELECT status FROM jobs WHERE source_id = $1 ORDER BY created_at DESC LIMIT 1) AS "latestJobStatus",
      (SELECT duration_ms FROM jobs WHERE source_id = $1 ORDER BY created_at DESC LIMIT 1) AS "latestJobDurationMs"`,
    [sourceId],
  );
  return result.rows[0] ?? null;
}

export async function getTotalSourceCount() {
  const result = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM sources`,
  );
  return result.rows[0].count;
}
