import cron from "node-cron";
import { runImport } from "./job-runner.js";
import { listSources } from "../services/source-service.js";
import { logger } from "../logger.js";

const log = logger.child({ module: "scheduler" });

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
    log.debug({ sourceId: source.id }, "Source has no schedule, removed from scheduler");
    return;
  }

  if (!isValidCron(source.schedule)) {
    log.error({ sourceId: source.id, schedule: source.schedule }, "Invalid cron expression, source will not be scheduled");
    return;
  }

  const task = cron.schedule(source.schedule, () => {
    log.info({ sourceId: source.id }, "Scheduler triggering import");
    runImport(source.id).catch((err) =>
      log.error({ sourceId: source.id, err }, "Scheduled import failed"),
    );
  });

  scheduledTasks.set(source.id, task);
  log.info({ sourceId: source.id, schedule: source.schedule }, "Source scheduled with cron");
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
      log.debug({ sourceId: id }, "Source schedule removed during refresh");
    }
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function startScheduler(intervalMs = 60_000): void {
  if (intervalHandle) return;

  refreshSchedules().catch((err) =>
    log.error({ err }, "Scheduler initial refresh failed"),
  );

  log.info({ intervalMs }, "Scheduler started");
  intervalHandle = setInterval(() => {
    refreshSchedules().catch((err) =>
      log.error({ err }, "Scheduler refresh failed"),
    );
  }, intervalMs);
}

export function isSchedulerRunning(): boolean {
  return intervalHandle !== null;
}

export function stopScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  for (const [id, task] of scheduledTasks) {
    task.stop();
    log.debug({ sourceId: id }, "Scheduler cron task stopped");
  }
  scheduledTasks.clear();

  log.info("Scheduler stopped");
}
