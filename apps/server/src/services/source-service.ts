import { eq } from "drizzle-orm";
import { sources } from "../db/schema.js";
import type { Database } from "../db/database.js";
import { db, query, pool } from "../db/pool.js";

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
    const result = await this.database.query<{
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

  async getTotalSourceCount() {
    const result = await this.database.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM sources`,
    );
    return result.rows[0].count;
  }
}

const _shimDb = {
  pool,
  db,
  query,
  getClient: async () => pool.connect(),
  end: async () => { await pool.end(); },
} as unknown as Database;

const _shim = new SourceService({ database: _shimDb });

export const listSources = _shim.listSources.bind(_shim);
export const getSource = _shim.getSource.bind(_shim);
export const getSourceByUrl = _shim.getSourceByUrl.bind(_shim);
export const createSource = _shim.createSource.bind(_shim);
export const deleteSource = _shim.deleteSource.bind(_shim);
export const updateSource = _shim.updateSource.bind(_shim);
export const updateLastImported = _shim.updateLastImported.bind(_shim);
export const getSourceStats = _shim.getSourceStats.bind(_shim);
export const getTotalSourceCount = _shim.getTotalSourceCount.bind(_shim);
