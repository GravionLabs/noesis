import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSource = vi.fn();
const mockUpdateLastImported = vi.fn();
const mockCreateJob = vi.fn();
const mockUpdateJobStatus = vi.fn();
const mockEmbed = vi.fn();
const mockQuery = vi.fn();

vi.mock("../../src/services/source-service.js", () => ({
  getSource: (...args: unknown[]) => mockGetSource(...args),
  updateLastImported: (...args: unknown[]) => mockUpdateLastImported(...args),
}));

vi.mock("../../src/services/job-service.js", () => ({
  createJob: (...args: unknown[]) => mockCreateJob(...args),
  updateJobStatus: (...args: unknown[]) => mockUpdateJobStatus(...args),
}));

vi.mock("../../src/services/embedding-service.js", () => ({
  embedUnembeddedChunks: (...args: unknown[]) => mockEmbed(...args),
}));

vi.mock("../../src/db/pool.js", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  db: {},
  pool: {},
}));

import { runImport } from "../../src/pipeline/job-runner.js";

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
  });

  it("imports and embeds for llmstxt sources", async () => {
    mockGetSource.mockResolvedValue({
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
    });

    mockCreateJob.mockResolvedValue({ id: "job-1" });
    mockUpdateJobStatus.mockResolvedValue(undefined);
    mockEmbed.mockResolvedValue(3);

    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: "doc-1" }], rowCount: 1 })
      .mockResolvedValue({ rowCount: 1 });

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
    });
    expect(mockUpdateJobStatus).toHaveBeenCalledWith("job-1", "running");
    expect(mockUpdateJobStatus).toHaveBeenCalledWith("job-1", "done");
    expect(mockEmbed).toHaveBeenCalledWith("src-1");
    expect(mockUpdateLastImported).toHaveBeenCalledWith("src-1");
  });

  it("marks job as failed on error", async () => {
    mockGetSource.mockResolvedValue({
      id: "src-2",
      importerType: "unknown",
    });

    mockCreateJob.mockResolvedValue({ id: "job-2" });
    mockUpdateJobStatus.mockResolvedValue(undefined);

    const job = await runImport("src-2");

    expect(job.id).toBe("job-2");
    expect(mockUpdateJobStatus).toHaveBeenCalledWith("job-2", "running");
    expect(mockUpdateJobStatus).toHaveBeenCalledWith(
      "job-2",
      "failed",
      expect.any(String),
    );
    expect(mockEmbed).not.toHaveBeenCalled();
  });

  it("throws if source not found", async () => {
    mockGetSource.mockResolvedValue(null);
    await expect(runImport("missing")).rejects.toThrow("not found");
  });
});
