/**
 * SourceService — source lifecycle management.
 *
 * Tables (owned): sources
 * Tables (read):  docs, chunks, jobs (in getSourceStats correlated subquery)
 *
 * DB access: Drizzle ORM for all CRUD; db.execute(sql``) for getSourceStats
 *   (single-round-trip correlated subquery returning 5 fields).
 * Key methods:
 *   createSource()       — deduplicates by URL; returns null on conflict (409)
 *   deleteSource()       — cascade deletes all dependents (docs, chunks,
 *                          embeddings, jobs) via DB-level ON DELETE CASCADE
 *   getSourceStats()     — docCount, chunkCount, avgTokenCount, latestJobStatus,
 *                          latestJobDurationMs in one query
 *   getTotalSourceCount() — used by StatsService
 */
import { eq, count, sql } from "drizzle-orm";
import { sources, docs, chunks, jobs } from "../db/schema.js";
import type { Database } from "../db/database.js";

export interface CreateSourceInput {
  name: string;
  url: string;
  importerType?: string;
  config?: string;
  schedule?: string;
}

export interface UpdateSourceInput {
  name?: string;
  url?: string;
  importerType?: string;
  enabled?: boolean;
  config?: string | null;
  schedule?: string | null;
}

export class SourceService {
  private database: Database;

  constructor({ database }: { database: Database }) {
    this.database = database;
  }

  async listSources() {
    return this.database.db.select().from(sources).orderBy(sources.name);
  }

  async getSource(id: string) {
    const rows = await this.database.db
      .select()
      .from(sources)
      .where(eq(sources.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async getSourceByUrl(url: string) {
    const rows = await this.database.db
      .select()
      .from(sources)
      .where(eq(sources.url, url))
      .limit(1);
    return rows[0] ?? null;
  }

  async createSource(input: CreateSourceInput) {
    const existing = await this.getSourceByUrl(input.url);
    if (existing) return null;

    const rows = await this.database.db
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

  async deleteSource(id: string) {
    const rows = await this.database.db
      .delete(sources)
      .where(eq(sources.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async updateSource(id: string, input: UpdateSourceInput) {
    const rows = await this.database.db
      .update(sources)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(sources.id, id))
      .returning();
    return rows[0] ?? null;
  }

  async updateLastImported(sourceId: string) {
    await this.database.db
      .update(sources)
      .set({ lastImportedAt: new Date(), updatedAt: new Date() })
      .where(eq(sources.id, sourceId));
  }

  async getSourceStats(sourceId: string) {
    const r = await this.database.db.execute<{
      docCount: number;
      chunkCount: number;
      avgTokenCount: number | null;
      latestJobStatus: string | null;
      latestJobDurationMs: number | null;
    }>(sql`
      SELECT
        (SELECT COUNT(*)::int FROM ${docs}   WHERE source_id = ${sourceId}) AS "docCount",
        (SELECT COUNT(*)::int FROM ${chunks} WHERE source_id = ${sourceId}) AS "chunkCount",
        (SELECT ROUND(AVG(token_count))::int FROM ${chunks} WHERE source_id = ${sourceId}) AS "avgTokenCount",
        (SELECT status      FROM ${jobs} WHERE source_id = ${sourceId} ORDER BY created_at DESC LIMIT 1) AS "latestJobStatus",
        (SELECT duration_ms FROM ${jobs} WHERE source_id = ${sourceId} ORDER BY created_at DESC LIMIT 1) AS "latestJobDurationMs"
    `);
    return (r.rows[0] as any) ?? null;
  }

  async getTotalSourceCount() {
    const r = await this.database.db.select({ count: count() }).from(sources);
    return Number(r[0].count);
  }
}
