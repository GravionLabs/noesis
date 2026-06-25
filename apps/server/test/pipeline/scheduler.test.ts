import { describe, it, expect, vi, beforeEach } from "vitest";
import cron from "node-cron";

const mockRunImport = vi.fn().mockResolvedValue({ id: "job-1" });
const mockListSources = vi.fn();

import { Scheduler } from "../../src/pipeline/scheduler.js";

function makeTask() {
  let stopped = false;
  return {
    stop: vi.fn(() => { stopped = true; }),
    get stopped() { return stopped; },
  };
}

function createScheduler() {
  return new Scheduler({
    jobRunner: { runImport: mockRunImport } as any,
    sourceService: { listSources: mockListSources } as any,
    logger: {
      child: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      }),
    } as any,
  });
}

describe("Scheduler", () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    vi.clearAllMocks();
    scheduler = createScheduler();
  });

  describe("isValidCron", () => {
    it("returns true for valid cron expressions", () => {
      const spy = vi.spyOn(cron, "validate").mockReturnValue(true);
      expect(scheduler.isValidCron("0 */6 * * *")).toBe(true);
      expect(spy).toHaveBeenCalledWith("0 */6 * * *");
    });

    it("returns false for invalid cron expressions", () => {
      vi.spyOn(cron, "validate").mockReturnValue(false);
      expect(scheduler.isValidCron("invalid")).toBe(false);
    });
  });

  describe("scheduleNextRun", () => {
    it("schedules a cron task for a source with a valid schedule", async () => {
      const task = makeTask();
      vi.spyOn(cron, "validate").mockReturnValue(true);
      const scheduleSpy = vi.spyOn(cron, "schedule").mockReturnValue(task);

      await scheduler.scheduleNextRun({ id: "src-1", schedule: "0 */6 * * *" });

      expect(cron.validate).toHaveBeenCalledWith("0 */6 * * *");
      expect(scheduleSpy).toHaveBeenCalledWith("0 */6 * * *", expect.any(Function));

      const cronFn = scheduleSpy.mock.calls[0][1];
      await cronFn();

      expect(mockRunImport).toHaveBeenCalledWith("src-1");
    });

    it("cancels previous task before re-scheduling for the same source", async () => {
      const task1 = makeTask();
      const task2 = makeTask();
      vi.spyOn(cron, "validate").mockReturnValue(true);
      const scheduleSpy = vi.spyOn(cron, "schedule")
        .mockReturnValueOnce(task1)
        .mockReturnValueOnce(task2);

      await scheduler.scheduleNextRun({ id: "src-1", schedule: "0 */6 * * *" });
      expect(scheduleSpy).toHaveBeenCalledTimes(1);

      await scheduler.scheduleNextRun({ id: "src-1", schedule: "0 */12 * * *" });
      expect(scheduleSpy).toHaveBeenCalledTimes(2);

      expect(task1.stop).toHaveBeenCalled();
      expect(task2.stop).not.toHaveBeenCalled();
    });

    it("is a no-op when schedule is null", async () => {
      const scheduleSpy = vi.spyOn(cron, "schedule");
      await scheduler.scheduleNextRun({ id: "src-1", schedule: null });
      expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it("is a no-op when schedule is empty string", async () => {
      const scheduleSpy = vi.spyOn(cron, "schedule");
      await scheduler.scheduleNextRun({ id: "src-1", schedule: "" });
      expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it("does not schedule when cron expression is invalid", async () => {
      vi.spyOn(cron, "validate").mockReturnValue(false);
      const scheduleSpy = vi.spyOn(cron, "schedule");

      await scheduler.scheduleNextRun({ id: "src-1", schedule: "bad-cron" });

      expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it("cancels existing task when schedule is removed", async () => {
      const task = makeTask();
      vi.spyOn(cron, "validate").mockReturnValue(true);
      const scheduleSpy = vi.spyOn(cron, "schedule").mockReturnValue(task);

      await scheduler.scheduleNextRun({ id: "src-1", schedule: "0 */6 * * *" });
      expect(scheduleSpy).toHaveBeenCalledTimes(1);

      await scheduler.scheduleNextRun({ id: "src-1", schedule: null });

      expect(task.stop).toHaveBeenCalled();
    });
  });

  describe("refreshSchedules", () => {
    beforeEach(() => {
      scheduler = createScheduler();
    });

    it("schedules all sources with a valid cron expression", async () => {
      const task = makeTask();
      vi.spyOn(cron, "validate").mockReturnValue(true);
      const scheduleSpy = vi.spyOn(cron, "schedule").mockReturnValue(task);

      mockListSources.mockResolvedValue([
        { id: "src-1", schedule: "0 */6 * * *" },
        { id: "src-2", schedule: "0 0 * * *" },
        { id: "src-3", schedule: null },
      ]);

      await scheduler.refreshSchedules();

      expect(scheduleSpy).toHaveBeenCalledTimes(2);
      expect(scheduleSpy).toHaveBeenCalledWith("0 */6 * * *", expect.any(Function));
      expect(scheduleSpy).toHaveBeenCalledWith("0 0 * * *", expect.any(Function));
    });

    it("unschedules sources whose schedule was removed", async () => {
      const task1 = makeTask();
      const task2 = makeTask();
      vi.spyOn(cron, "validate").mockReturnValue(true);
      const scheduleSpy = vi.spyOn(cron, "schedule")
        .mockReturnValueOnce(task1)
        .mockReturnValueOnce(task2);

      mockListSources.mockResolvedValue([
        { id: "src-1", schedule: "0 */6 * * *" },
        { id: "src-2", schedule: "0 0 * * *" },
      ]);

      await scheduler.refreshSchedules();

      expect(scheduleSpy).toHaveBeenCalledTimes(2);

      mockListSources.mockResolvedValue([
        { id: "src-1", schedule: "0 */6 * * *" },
        { id: "src-2", schedule: null },
      ]);

      await scheduler.refreshSchedules();

      expect(scheduleSpy).toHaveBeenCalledTimes(3);
      expect(task2.stop).toHaveBeenCalled();
    });
  });

  describe("unschedule", () => {
    it("stops and removes a scheduled task by sourceId", async () => {
      const task = makeTask();
      vi.spyOn(cron, "validate").mockReturnValue(true);
      vi.spyOn(cron, "schedule").mockReturnValue(task);

      await scheduler.scheduleNextRun({ id: "src-1", schedule: "0 */6 * * *" });
      expect((scheduler as any).scheduledTasks.size).toBe(1);

      scheduler.unschedule("src-1");

      expect(task.stop).toHaveBeenCalled();
      expect((scheduler as any).scheduledTasks.size).toBe(0);
    });

    it("is a no-op for a sourceId that has no scheduled task", () => {
      expect(() => scheduler.unschedule("nonexistent-id")).not.toThrow();
    });
  });
});
