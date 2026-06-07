import { db } from "../db/pool.js";
import { sources } from "../db/schema.js";
import { eq, isNotNull } from "drizzle-orm";
import { runImport } from "./job-runner.js";

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export async function scheduleNextRun(sourceId: string): Promise<void> {
  console.log("[scheduler] scheduleNextRun(%s) — stub", sourceId);
}

export async function refreshSchedules(): Promise<void> {
  const scheduled = await db
    .select()
    .from(sources)
    .where(eq(sources.enabled, true));

  for (const source of scheduled) {
    if (source.schedule) {
      console.log("[scheduler] source %s has cron %s", source.id, source.schedule);
    }
  }
}

export function startScheduler(intervalMs = 60_000): void {
  if (intervalHandle) return;
  console.log("[scheduler] started (poll every %dms)", intervalMs);
  intervalHandle = setInterval(() => {
    refreshSchedules().catch((err) =>
      console.error("[scheduler] refresh error:", err),
    );
  }, intervalMs);
}

export function stopScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[scheduler] stopped");
  }
}
