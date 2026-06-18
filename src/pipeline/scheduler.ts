import cron from "node-cron";
import { runImport } from "./job-runner.js";
import { listSources } from "../services/source-service.js";

export interface SourceSchedule {
  id: string;
  schedule: string | null;
}

const scheduledTasks = new Map<string, cron.ScheduledTask>();

export function isValidCron(expr: string): boolean {
  return cron.validate(expr);
}

export async function scheduleNextRun(source: SourceSchedule): Promise<void> {
  const existing = scheduledTasks.get(source.id);
  if (existing) {
    existing.stop();
    scheduledTasks.delete(source.id);
  }

  if (!source.schedule) {
    console.log("[scheduler] source %s: no schedule, unscheduled", source.id);
    return;
  }

  if (!isValidCron(source.schedule)) {
    console.error(
      "[scheduler] source %s: invalid cron expression '%s'",
      source.id,
      source.schedule,
    );
    return;
  }

  const task = cron.schedule(source.schedule, () => {
    console.log("[scheduler] triggering import for source %s", source.id);
    runImport(source.id).catch((err) =>
      console.error("[scheduler] import error for source %s: %s", source.id, err),
    );
  });

  scheduledTasks.set(source.id, task);
  console.log(
    "[scheduler] source %s scheduled with cron '%s'",
    source.id,
    source.schedule,
  );
}

export async function refreshSchedules(): Promise<void> {
  const allSources = await listSources();

  const activeIds = new Set<string>();

  for (const source of allSources) {
    if (source.schedule) {
      activeIds.add(source.id);
      await scheduleNextRun(source);
    }
  }

  for (const [id] of scheduledTasks) {
    if (!activeIds.has(id)) {
      const task = scheduledTasks.get(id)!;
      task.stop();
      scheduledTasks.delete(id);
      console.log("[scheduler] source %s: schedule removed, unscheduled", id);
    }
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startScheduler(intervalMs = 60_000): void {
  if (intervalHandle) return;

  refreshSchedules().catch((err) =>
    console.error("[scheduler] initial refresh error:", err),
  );

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
  }

  for (const [id, task] of scheduledTasks) {
    task.stop();
    console.log("[scheduler] source %s: stopped", id);
  }
  scheduledTasks.clear();

  console.log("[scheduler] stopped");
}
