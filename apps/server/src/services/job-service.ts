/**
 * JobService — import job lifecycle management.
 *
 * Tables (owned): jobs, job_logs
 *
 * DB access: Drizzle ORM for all CRUD; db.execute(sql``) for getAvgImportDuration
 *   (needs ROUND(AVG(...))::int which has no Drizzle aggregate helper).
 * Key methods:
 *   createJob()          — creates a pending job for a source import
 *   completeJob()        — marks done; accepts optional result JSON (chunksDropped)
 *   failJob()            — marks failed; persists retryCount for retry tracking
 *   getRunningJob()      — used by job-runner to prevent duplicate concurrent imports
 *   getPendingJobCount() — used by StatsService
 *   getAvgImportDuration() — used by StatsService
 *   appendLog()          — inserts a log entry for a job
 *   getJobLogs()         — retrieves recent log entries for a job
 */
import { eq, desc, and, count, sql } from "drizzle-orm";
import { jobs, jobLogs } from "../db/schema.js";
import type { Database } from "../db/database.js";

export interface JobLogEntry {
  id: string;
  jobId: string;
  message: string;
  level: string;
  createdAt: string;
}

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
    if (["done", "failed", "cancelled"].includes(status)) update.finishedAt = now;
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

  async appendLog(jobId: string, message: string, level = "info") {
    await this.database.db.insert(jobLogs).values({
      jobId,
      message,
      level,
    });
  }

  async getJobLogs(jobId: string, limit = 200) {
    const rows = await this.database.db
      .select()
      .from(jobLogs)
      .where(eq(jobLogs.jobId, jobId))
      .orderBy(desc(jobLogs.createdAt))
      .limit(limit);
    return rows.reverse();
  }

  async requestCancel(jobId: string) {
    await this.database.db
      .update(jobs)
      .set({ cancelRequestedAt: new Date() })
      .where(eq(jobs.id, jobId));
  }

  async cancelJob(jobId: string) {
    const now = new Date();
    await this.database.db
      .update(jobs)
      .set({
        status: "cancelled",
        finishedAt: now,
        error: "Job cancelled by user",
      })
      .where(eq(jobs.id, jobId));
  }

  async isCancelRequested(jobId: string): Promise<boolean> {
    const rows = await this.database.db
      .select({ cancelRequestedAt: jobs.cancelRequestedAt })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);
    return rows[0]?.cancelRequestedAt !== null && rows[0]?.cancelRequestedAt !== undefined;
  }

  async completeJob(id: string, durationMs: number, result?: string) {
    await this.database.db
      .update(jobs)
      .set({ status: "done", finishedAt: new Date(), durationMs, ...(result !== undefined ? { result } : {}) })
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
    const r = await this.database.db
      .select({ count: count() })
      .from(jobs)
      .where(eq(jobs.status, "pending"));
    return Number(r[0].count);
  }

  async getTotalJobCount() {
    const r = await this.database.db.select({ count: count() }).from(jobs);
    return Number(r[0].count);
  }

  async getAvgImportDuration() {
    const r = await this.database.db.execute<{ avg: number | null }>(
      sql`SELECT ROUND(AVG(duration_ms))::int AS avg FROM ${jobs} WHERE duration_ms IS NOT NULL`,
    );
    return (r.rows[0]?.avg as number | null) ?? 0;
  }
}
