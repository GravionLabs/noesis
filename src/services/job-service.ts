import { db, query } from "../db/pool.js";
import { jobs } from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";

export async function createJob(input: {
  type?: string;
  sourceId?: string;
  status?: string;
  maxRetries?: number;
}) {
  const rows = await db
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

export async function getJob(id: string) {
  const rows = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listJobs(limit = 50) {
  return db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(limit);
}

export async function updateJobStatus(
  id: string,
  status: string,
  error?: string,
) {
  const now = new Date();
  const update: Record<string, unknown> = { status };
  if (status === "running") update.startedAt = now;
  if (["done", "failed"].includes(status)) update.finishedAt = now;
  if (error) update.error = error;
  await db.update(jobs).set(update).where(eq(jobs.id, id));
}

export async function getRunningJob(sourceId: string) {
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.sourceId, sourceId), eq(jobs.status, "running")))
    .limit(1);
  return rows[0] ?? null;
}

export async function completeJob(
  id: string,
  durationMs: number,
) {
  await db
    .update(jobs)
    .set({ status: "done", finishedAt: new Date(), durationMs })
    .where(eq(jobs.id, id));
}

export async function failJob(
  id: string,
  error: string,
  durationMs: number,
  retryCount: number,
) {
  await db
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

export async function getPendingJobCount() {
  const result = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM jobs WHERE status = 'pending'`,
  );
  return result.rows[0].count;
}

export async function getTotalJobCount() {
  const result = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM jobs`,
  );
  return result.rows[0].count;
}

export async function getAvgImportDuration() {
  const result = await query<{ avg: number | null }>(
    `SELECT ROUND(AVG(duration_ms))::int AS avg FROM jobs WHERE duration_ms IS NOT NULL`,
  );
  return result.rows[0].avg ?? 0;
}
