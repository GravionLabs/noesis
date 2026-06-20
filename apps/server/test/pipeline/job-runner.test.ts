import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetSource = vi.fn();
const mockUpdateLastImported = vi.fn();
const mockCreateJob = vi.fn();
const mockGetJob = vi.fn();
const mockCompleteJob = vi.fn();
const mockFailJob = vi.fn();
const mockGetRunningJob = vi.fn();
const mockGetImporter = vi.fn();
const mockUpdateJobStatus = vi.fn();
const mockEmbed = vi.fn();
const mockQuery = vi.fn();

vi.mock("../../src/services/source-service.js", () => ({
  getSource: (...args: unknown[]) => mockGetSource(...args),
  updateLastImported: (...args: unknown[]) => mockUpdateLastImported(...args),
}));

vi.mock("../../src/services/job-service.js", () => ({
  createJob: (...args: unknown[]) => mockCreateJob(...args),
  getJob: (...args: unknown[]) => mockGetJob(...args),
  getRunningJob: (...args: unknown[]) => mockGetRunningJob(...args),
  updateJobStatus: (...args: unknown[]) => mockUpdateJobStatus(...args),
  completeJob: (...args: unknown[]) => mockCompleteJob(...args),
  failJob: (...args: unknown[]) => mockFailJob(...args),
}));

vi.mock("../../src/services/embedding-service.js", () => ({
  embedUnembeddedChunks: (...args: unknown[]) => mockEmbed(...args),
}));

vi.mock("../../src/importers/registry.js", () => ({
  getImporter: (...args: unknown[]) => mockGetImporter(...args),
}));

vi.mock("../../src/db/pool.js", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  db: {},
  pool: {},
}));

vi.mock("../../src/config.js", () => ({
  config: {
    MAX_IMPORT_RETRIES: 3,
    LOG_LEVEL: "silent",
    EMBEDDING_PROVIDER: "local",
    EMBEDDING_MODEL: "test",
    EMBEDDING_DIMENSIONS: 768,
  },
}));

import { runImport } from "../../src/pipeline/job-runner.js";

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    mockGetRunningJob.mockResolvedValue(null);
    mockGetImporter.mockReturnValue(null);
    mockUpdateJobStatus.mockResolvedValue(undefined);
    mockGetJob.mockImplementation((id: string) => Promise.resolve({ id, status: "done" }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("imports and embeds for llmstxt sources", async () => {
    mockGetSource.mockResolvedValue(sourceFixture);
    mockCreateJob.mockResolvedValue({ id: "job-1" });
    mockCompleteJob.mockResolvedValue(undefined);
    mockEmbed.mockResolvedValue(3);

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "doc-1" }], rowCount: 1 })
      .mockResolvedValue({ rowCount: 1 });

    const mockImporter = { import: vi.fn().mockResolvedValue({ chunkCount: 5 }) };
    mockGetImporter.mockReturnValue(mockImporter);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      text: async () => sampleText,
    } as Response);

    const job = await runImport("src-1");

    expect(job.id).toBe("job-1");
    expect(mockGetSource).toHaveBeenCalledWith("src-1");
    expect(mockCreateJob).toHaveBeenCalledWith({
      type: "import",
      sourceId: "src-1",
      status: "pending",
      maxRetries: 3,
    });
    expect(mockCompleteJob).toHaveBeenCalledWith("job-1", expect.any(Number));
    expect(mockEmbed).toHaveBeenCalledWith("src-1");
    expect(mockUpdateLastImported).toHaveBeenCalledWith("src-1");
  });

  it("marks job as failed on error", async () => {
    mockGetSource.mockResolvedValue(sourceFixture);
    mockCreateJob.mockResolvedValue({ id: "job-2" });
    mockFailJob.mockResolvedValue(undefined);
    mockGetImporter.mockReturnValue(null);

    const promise = runImport("src-2");
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
    await expect(runImport("missing")).rejects.toThrow("not found");
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

    mockQuery
      .mockResolvedValue({ rows: [{ id: "doc-1" }], rowCount: 1 });

    const promise = runImport("src-1");

    await vi.advanceTimersByTimeAsync(15000);

    const job = await promise;

    expect(job.id).toBe("job-2");
    expect(mockFailJob).toHaveBeenCalledWith(
      "job-1",
      "Network error",
      expect.any(Number),
      0,
    );
    expect(mockCompleteJob).toHaveBeenCalledWith("job-2", expect.any(Number));
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

    mockQuery
      .mockResolvedValue({ rows: [], rowCount: 0 });

    const promise = runImport("src-1");

    await vi.advanceTimersByTimeAsync(100000);

    await promise;

    expect(mockFailJob).toHaveBeenCalledTimes(4);
  });

  it("prevents overlapping imports for the same source", async () => {
    mockGetRunningJob.mockResolvedValue({ id: "existing-job", sourceId: "src-1", status: "running" });

    const job = await runImport("src-1");

    expect(job.id).toBe("existing-job");
    expect(mockGetSource).not.toHaveBeenCalled();
    expect(mockCreateJob).not.toHaveBeenCalled();
  });
});
