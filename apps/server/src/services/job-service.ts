import { eq, desc, and } from "drizzle-orm";
import { jobs } from "../db/schema.js";
import type { Database } from "../db/database.js";

export class JobService {
  private database: Database;

  constructor({ database }: { database: Database }) {
    this.database = database;
  }

  async createJob(input: {
    type?: string;
    sourceId?: string;
    status?: string;
    maxRetries?: number;
  }) {
    const rows = await this.database.db
      .insert(jobs)
      .values({
        type: input.type ?? "import",
        sourceId: input.sourceId ?? null,
        status: input.status ?? "pending",
        maxRetries: input.maxRetries ?? 3,
      })
      .returning();
    return rows[0];
  }

  async getJob(id: string) {
    const rows = await this.database.db
      .select()
      .from(jobs)
      .where(eq(jobs.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async listJobs(limit = 50) {
    return this.database.db
      .select()
      .from(jobs)
      .orderBy(desc(jobs.createdAt))
      .limit(limit);
  }

  async updateJobStatus(id: string, status: string, error?: string) {
    const now = new Date();
    const update: Record<string, unknown> = { status };
    if (status === "running") update.startedAt = now;
    if (["done", "failed"].includes(status)) update.finishedAt = now;
    if (error) update.error = error;
    await this.database.db.update(jobs).set(update).where(eq(jobs.id, id));
  }

  async getRunningJob(sourceId: string) {
    const rows = await this.database.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.sourceId, sourceId), eq(jobs.status, "running")))
      .limit(1);
    return rows[0] ?? null;
  }

  async completeJob(id: string, durationMs: number) {
    await this.database.db
      .update(jobs)
      .set({ status: "done", finishedAt: new Date(), durationMs })
      .where(eq(jobs.id, id));
  }

  async failJob(
    id: string,
    error: string,
    durationMs: number,
    retryCount: number,
  ) {
    await this.database.db
      .update(jobs)
      .set({
        status: "failed",
        finishedAt: new Date(),
        error,
        durationMs,
        retryCount,
      })
      .where(eq(jobs.id, id));
  }

  async getPendingJobCount() {
    const result = await this.database.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM jobs WHERE status = 'pending'`,
    );
    return result.rows[0].count;
  }

  async getTotalJobCount() {
    const result = await this.database.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM jobs`,
    );
    return result.rows[0].count;
  }

  async getAvgImportDuration() {
    const result = await this.database.query<{ avg: number | null }>(
      `SELECT ROUND(AVG(duration_ms))::int AS avg FROM jobs WHERE duration_ms IS NOT NULL`,
    );
    return result.rows[0].avg ?? 0;
  }
}

import { db, query, pool } from "../db/pool.js";

const _shimDb = {
  pool,
  db,
  query,
  getClient: async () => pool.connect(),
  end: async () => { await pool.end(); },
} as unknown as Database;

const _shim = new JobService({ database: _shimDb });

export const createJob = _shim.createJob.bind(_shim);
export const getJob = _shim.getJob.bind(_shim);
export const listJobs = _shim.listJobs.bind(_shim);
export const updateJobStatus = _shim.updateJobStatus.bind(_shim);
export const getRunningJob = _shim.getRunningJob.bind(_shim);
export const completeJob = _shim.completeJob.bind(_shim);
export const failJob = _shim.failJob.bind(_shim);
export const getPendingJobCount = _shim.getPendingJobCount.bind(_shim);
export const getTotalJobCount = _shim.getTotalJobCount.bind(_shim);
export const getAvgImportDuration = _shim.getAvgImportDuration.bind(_shim);
