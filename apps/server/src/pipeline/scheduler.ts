import cron from "node-cron";
import type { JobRunner } from "./job-runner.js";
import type { SourceService } from "../services/source-service.js";
import { logger as _logger } from "../logger.js";

export interface SourceSchedule {
  id: string;
  schedule: string | null;
}

export class Scheduler {
  private jobRunner: JobRunner;
  private sourceService: SourceService;
  private log: ReturnType<typeof _logger.child>;
  private scheduledTasks = new Map<string, cron.ScheduledTask>();
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  constructor({
    jobRunner,
    sourceService,
    logger,
  }: {
    jobRunner: JobRunner;
    sourceService: SourceService;
    logger: typeof _logger;
  }) {
    this.jobRunner = jobRunner;
    this.sourceService = sourceService;
    this.log = logger.child({ module: "scheduler" });
  }

  isValidCron(expr: string): boolean {
    return cron.validate(expr);
  }

  async scheduleNextRun(source: SourceSchedule): Promise<void> {
    const existing = this.scheduledTasks.get(source.id);
    if (existing) {
      existing.stop();
      this.scheduledTasks.delete(source.id);
    }

    if (!source.schedule) {
      this.log.debug({ sourceId: source.id }, "Source has no schedule, removed from scheduler");
      return;
    }

    if (!this.isValidCron(source.schedule)) {
      this.log.error({ sourceId: source.id, schedule: source.schedule }, "Invalid cron expression, source will not be scheduled");
      return;
    }

    const task = cron.schedule(source.schedule, () => {
      this.log.info({ sourceId: source.id }, "Scheduler triggering import");
      this.jobRunner.runImport(source.id).catch((err: Error) =>
        this.log.error({ sourceId: source.id, err }, "Scheduled import failed"),
      );
    });

    this.scheduledTasks.set(source.id, task);
    this.log.info({ sourceId: source.id, schedule: source.schedule }, "Source scheduled with cron");
  }

  async refreshSchedules(): Promise<void> {
    const allSources = await this.sourceService.listSources();

    const activeIds = new Set<string>();

    for (const source of allSources) {
      if (source.schedule) {
        activeIds.add(source.id);
        await this.scheduleNextRun(source);
      }
    }

    for (const [id] of this.scheduledTasks) {
      if (!activeIds.has(id)) {
        const task = this.scheduledTasks.get(id)!;
        task.stop();
        this.scheduledTasks.delete(id);
        this.log.debug({ sourceId: id }, "Source schedule removed during refresh");
      }
    }
  }

  startScheduler(intervalMs = 60_000): void {
    if (this.intervalHandle) return;

    this.refreshSchedules().catch((err) =>
      this.log.error({ err }, "Scheduler initial refresh failed"),
    );

    this.log.info({ intervalMs }, "Scheduler started");
    this.intervalHandle = setInterval(() => {
      this.refreshSchedules().catch((err) =>
        this.log.error({ err }, "Scheduler refresh failed"),
      );
    }, intervalMs);
  }

  isSchedulerRunning(): boolean {
    return this.intervalHandle !== null;
  }

  unschedule(sourceId: string): void {
    const task = this.scheduledTasks.get(sourceId);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(sourceId);
      this.log.debug({ sourceId }, "Source unscheduled");
    }
  }

  stopScheduler(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    for (const [id, task] of this.scheduledTasks) {
      task.stop();
      this.log.debug({ sourceId: id }, "Scheduler cron task stopped");
    }
    this.scheduledTasks.clear();

    this.log.info("Scheduler stopped");
  }
}
