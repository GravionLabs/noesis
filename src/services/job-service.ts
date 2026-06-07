import { db } from "../db/pool.js";
import { jobs } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";

export async function createJob(input: {
  type?: string;
  sourceId?: string;
  status?: string;
}) {
  const rows = await db
    .insert(jobs)
    .values({
      type: input.type ?? "import",
      sourceId: input.sourceId ?? null,
      status: input.status ?? "pending",
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
