import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRunImport = vi.fn().mockResolvedValue({ id: "job-1" });
const mockListSources = vi.fn();

const mockCronValidate = vi.fn();
const mockCronSchedule = vi.fn();

vi.mock("node-cron", () => ({
  default: {
    validate: (...args: unknown[]) => mockCronValidate(...args),
    schedule: (...args: unknown[]) => mockCronSchedule(...args),
  },
}));

vi.mock("../../src/services/source-service.js", () => ({
  listSources: (...args: unknown[]) => mockListSources(...args),
}));

vi.mock("../../src/pipeline/job-runner.js", () => ({
  runImport: (...args: unknown[]) => mockRunImport(...args),
}));

import {
  isValidCron,
  scheduleNextRun,
  refreshSchedules,
  stopScheduler,
} from "../../src/pipeline/scheduler.js";

function makeTask() {
  let stopped = false;
  return {
    stop: vi.fn(() => { stopped = true; }),
    get stopped() { return stopped; },
  };
}

describe("isValidCron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true for valid cron expressions", () => {
    mockCronValidate.mockReturnValue(true);
    expect(isValidCron("0 */6 * * *")).toBe(true);
    expect(mockCronValidate).toHaveBeenCalledWith("0 */6 * * *");
  });

  it("returns false for invalid cron expressions", () => {
    mockCronValidate.mockReturnValue(false);
    expect(isValidCron("invalid")).toBe(false);
  });
});

describe("scheduleNextRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopScheduler();
  });

  it("schedules a cron task for a source with a valid schedule", async () => {
    const task = makeTask();
    mockCronValidate.mockReturnValue(true);
    mockCronSchedule.mockReturnValue(task);

    await scheduleNextRun({ id: "src-1", schedule: "0 */6 * * *" });

    expect(mockCronValidate).toHaveBeenCalledWith("0 */6 * * *");
    expect(mockCronSchedule).toHaveBeenCalledWith("0 */6 * * *", expect.any(Function));

    // Trigger the scheduled callback
    const cronFn = mockCronSchedule.mock.calls[0][1];
    await cronFn();

    expect(mockRunImport).toHaveBeenCalledWith("src-1");
  });

  it("cancels previous task before re-scheduling for the same source", async () => {
    const task1 = makeTask();
    const task2 = makeTask();
    mockCronValidate.mockReturnValue(true);
    mockCronSchedule.mockReturnValueOnce(task1).mockReturnValueOnce(task2);

    await scheduleNextRun({ id: "src-1", schedule: "0 */6 * * *" });
    expect(mockCronSchedule).toHaveBeenCalledTimes(1);

    await scheduleNextRun({ id: "src-1", schedule: "0 */12 * * *" });
    expect(mockCronSchedule).toHaveBeenCalledTimes(2);

    expect(task1.stop).toHaveBeenCalled();
    expect(task2.stop).not.toHaveBeenCalled();
  });

  it("is a no-op when schedule is null", async () => {
    await scheduleNextRun({ id: "src-1", schedule: null });
    expect(mockCronSchedule).not.toHaveBeenCalled();
  });

  it("is a no-op when schedule is empty string", async () => {
    await scheduleNextRun({ id: "src-1", schedule: "" });
    expect(mockCronSchedule).not.toHaveBeenCalled();
  });

  it("does not schedule when cron expression is invalid", async () => {
    mockCronValidate.mockReturnValue(false);

    await scheduleNextRun({ id: "src-1", schedule: "bad-cron" });

    expect(mockCronValidate).toHaveBeenCalledWith("bad-cron");
    expect(mockCronSchedule).not.toHaveBeenCalled();
  });

  it("cancels existing task when schedule is removed", async () => {
    const task = makeTask();
    mockCronValidate.mockReturnValue(true);
    mockCronSchedule.mockReturnValue(task);

    await scheduleNextRun({ id: "src-1", schedule: "0 */6 * * *" });
    expect(mockCronSchedule).toHaveBeenCalledTimes(1);

    await scheduleNextRun({ id: "src-1", schedule: null });

    expect(task.stop).toHaveBeenCalled();
  });
});

describe("refreshSchedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stopScheduler();
  });

  it("schedules all sources with a valid cron expression", async () => {
    const task = makeTask();
    mockCronValidate.mockReturnValue(true);
    mockCronSchedule.mockReturnValue(task);

    mockListSources.mockResolvedValue([
      { id: "src-1", schedule: "0 */6 * * *" },
      { id: "src-2", schedule: "0 0 * * *" },
      { id: "src-3", schedule: null },
    ]);

    await refreshSchedules();

    expect(mockCronSchedule).toHaveBeenCalledTimes(2);
    expect(mockCronSchedule).toHaveBeenCalledWith("0 */6 * * *", expect.any(Function));
    expect(mockCronSchedule).toHaveBeenCalledWith("0 0 * * *", expect.any(Function));
  });

  it("unschedules sources whose schedule was removed", async () => {
    const task1 = makeTask();
    const task2 = makeTask();
    mockCronValidate.mockReturnValue(true);
    mockCronSchedule.mockReturnValueOnce(task1).mockReturnValueOnce(task2);

    mockListSources.mockResolvedValue([
      { id: "src-1", schedule: "0 */6 * * *" },
      { id: "src-2", schedule: "0 0 * * *" },
    ]);

    await refreshSchedules();

    expect(mockCronSchedule).toHaveBeenCalledTimes(2);

    mockListSources.mockResolvedValue([
      { id: "src-1", schedule: "0 */6 * * *" },
      { id: "src-2", schedule: null },
    ]);

    await refreshSchedules();

    expect(mockCronSchedule).toHaveBeenCalledTimes(3);
    expect(task2.stop).toHaveBeenCalled();
  });
});
