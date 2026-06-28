import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const jobStatusStore = new Map<string, string>();

const mockGetSource = vi.fn();
const mockUpdateLastImported = vi.fn();
const mockCreateJob = vi.fn();
const mockGetJob = vi.fn();
const mockCompleteJob = vi.fn();
const mockFailJob = vi.fn();
const mockGetRunningJob = vi.fn();
const mockIsCancelRequested = vi.fn();
const mockGetImporter = vi.fn();
const mockUpdateJobStatus = vi.fn();
const mockEmbed = vi.fn();
const mockCancelJob = vi.fn();
const mockAppendLog = vi.fn();

import { JobRunner } from "../../src/pipeline/job-runner.js";

const sourceFixture = {
  id: "src-1",
  name: "Test",
  url: "https://example.com/llms-full.txt",
  importerType: "llmstxt",
  enabled: true,
  config: null,
  schedule: null,
  lastImportedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function block(text: string, n = 3): string {
  return (text + "\n").repeat(n);
}

const sampleText = [
  "# Test Docs",
  "",
  block("This is a sample documentation page with enough text to exceed 50 characters.", 5),
  "",
  "## Section 1",
  "",
  block("Content under section one that exceeds the minimum length of 50 characters.", 5),
  "",
  "## Section 2",
  "",
  block("Content under section two that also exceeds the minimum length threshold.", 5),
].join("\n");

describe("runImport", () => {
  let runner: JobRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    mockGetRunningJob.mockResolvedValue(null);
    mockIsCancelRequested.mockResolvedValue(false);
    mockGetImporter.mockReturnValue(null);
    mockUpdateJobStatus.mockResolvedValue(undefined);
    mockCancelJob.mockResolvedValue(undefined);
    mockAppendLog.mockResolvedValue(undefined);
    mockGetJob.mockImplementation((id: string) => Promise.resolve({ id, status: "done" }));
    mockUpdateJobStatus.mockImplementation(async (_id: string, status: string) => {
      mockGetJob.mockImplementation((id: string) => Promise.resolve({ id, status }));
    });

    runner = new JobRunner({
      sourceService: {
        getSource: mockGetSource,
        updateLastImported: mockUpdateLastImported,
      } as any,
      jobService: {
        createJob: mockCreateJob,
        getJob: mockGetJob,
        getRunningJob: mockGetRunningJob,
        isCancelRequested: mockIsCancelRequested,
        updateJobStatus: mockUpdateJobStatus,
        completeJob: mockCompleteJob,
        failJob: mockFailJob,
        cancelJob: mockCancelJob,
        appendLog: mockAppendLog,
      } as any,
      importerRegistry: {
        getImporter: mockGetImporter,
      } as any,
      embeddingService: {
        embedUnembeddedChunks: mockEmbed,
      } as any,
      config: {
        MAX_IMPORT_RETRIES: 3,
        LOG_LEVEL: "silent",
        EMBEDDING_PROVIDER: "local",
        EMBEDDING_MODEL: "test",
        EMBEDDING_DIMENSIONS: 768,
      } as any,
      logger: {
        child: () => ({
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
        }),
      } as any,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("imports and embeds for llmstxt sources", async () => {
    mockGetSource.mockResolvedValue(sourceFixture);
    mockCreateJob.mockResolvedValue({ id: "job-1" });
    mockCompleteJob.mockResolvedValue(undefined);
    mockEmbed.mockResolvedValue(3);

    const mockImporter = { import: vi.fn().mockResolvedValue({ chunkCount: 5 }) };
    mockGetImporter.mockReturnValue(mockImporter);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => sampleText,
    } as Response);

    const job = await runner.runImport("src-1");

    expect(job.id).toBe("job-1");
    expect(mockGetSource).toHaveBeenCalledWith("src-1");
    expect(mockCreateJob).toHaveBeenCalledWith({
      type: "import",
      sourceId: "src-1",
      status: "pending",
      maxRetries: 3,
    });
    expect(mockCompleteJob).toHaveBeenCalledWith("job-1", expect.any(Number), undefined);
    expect(mockEmbed).toHaveBeenCalledWith("src-1");
    expect(mockUpdateLastImported).toHaveBeenCalledWith("src-1");
  });

  it("marks job as failed on error", async () => {
    mockGetSource.mockResolvedValue(sourceFixture);
    mockCreateJob.mockResolvedValue({ id: "job-2" });
    mockFailJob.mockResolvedValue(undefined);
    mockGetImporter.mockReturnValue(null);

    const promise = runner.runImport("src-2");
    await vi.advanceTimersByTimeAsync(120000);
    await promise;

    expect(mockFailJob).toHaveBeenCalledWith(
      "job-2",
      expect.any(String),
      expect.any(Number),
      0,
    );
    expect(mockEmbed).not.toHaveBeenCalled();
  });

  it("throws if source not found", async () => {
    mockGetSource.mockResolvedValue(null);
    await expect(runner.runImport("missing")).rejects.toThrow("not found");
  });

  it("retries after failure with backoff", async () => {
    mockGetSource.mockResolvedValue(sourceFixture);
    mockCreateJob
      .mockResolvedValueOnce({ id: "job-1" })
      .mockResolvedValueOnce({ id: "job-2" });
    mockFailJob.mockResolvedValue(undefined);
    mockCompleteJob.mockResolvedValue(undefined);
    mockEmbed.mockResolvedValue(3);

    const mockImporter = { import: vi.fn() };
    mockImporter.import
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ chunkCount: 5 });
    mockGetImporter.mockReturnValue(mockImporter);

    const promise = runner.runImport("src-1");

    await vi.advanceTimersByTimeAsync(15000);

    const job = await promise;

    expect(job.id).toBe("job-2");
    expect(mockFailJob).toHaveBeenCalledWith(
      "job-1",
      "Network error",
      expect.any(Number),
      0,
    );
    expect(mockCompleteJob).toHaveBeenCalledWith("job-2", expect.any(Number), undefined);
  });

  it("stops retrying after max retries reached", async () => {
    mockGetSource.mockResolvedValue(sourceFixture);
    mockCreateJob
      .mockResolvedValueOnce({ id: "job-1" })
      .mockResolvedValueOnce({ id: "job-2" })
      .mockResolvedValueOnce({ id: "job-3" })
      .mockResolvedValueOnce({ id: "job-4" });
    mockFailJob.mockResolvedValue(undefined);
    mockEmbed.mockResolvedValue(0);

    const mockImporter = { import: vi.fn().mockRejectedValue(new Error("Always fails")) };
    mockGetImporter.mockReturnValue(mockImporter);

    const promise = runner.runImport("src-1");

    await vi.advanceTimersByTimeAsync(100000);

    await promise;

    expect(mockFailJob).toHaveBeenCalledTimes(4);
  });

  it("cancels a running import when cancelJob is called", async () => {
    mockGetSource.mockResolvedValue(sourceFixture);
    mockCreateJob.mockResolvedValue({ id: "job-cancel-1" });
    mockUpdateJobStatus.mockResolvedValue(undefined);
    mockAppendLog.mockResolvedValue(undefined);

    let capturedSignal: AbortSignal | null = null;
    const mockImporter = {
      import: vi.fn().mockImplementation(async (_source: any, signal: AbortSignal) => {
        capturedSignal = signal;
        await new Promise((resolve) => setTimeout(resolve, 10000));
        if (signal.aborted) throw new Error("Job cancelled during execution");
        return { chunkCount: 0 };
      }),
    };
    mockGetImporter.mockReturnValue(mockImporter);

    const promise = runner.runImport("src-1");

    // Let microtasks resolve so executeImport reaches importer.import()
    await vi.advanceTimersByTimeAsync(0);

    expect(capturedSignal).not.toBeNull();
    const abortSpy = vi.fn();
    capturedSignal!.addEventListener("abort", abortSpy);

    await runner.cancelJob("job-cancel-1");

    expect(abortSpy).toHaveBeenCalled();

    // Advance timers so the mocked importer's setTimeout resolves and throws
    await vi.advanceTimersByTimeAsync(10000);

    expect(mockUpdateJobStatus).toHaveBeenLastCalledWith("job-cancel-1", "cancelled", expect.any(String));
  });

  it("prevents overlapping imports for the same source", async () => {
    mockGetRunningJob.mockResolvedValue({ id: "existing-job", sourceId: "src-1", status: "running" });

    const job = await runner.runImport("src-1");

    expect(job.id).toBe("existing-job");
    expect(mockGetSource).not.toHaveBeenCalled();
    expect(mockCreateJob).not.toHaveBeenCalled();
  });
});
