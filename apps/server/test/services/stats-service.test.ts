import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetTotalSourceCount = vi.fn();
const mockGetTotalJobCount = vi.fn();
const mockGetAvgImportDuration = vi.fn();
const mockDbFrom = vi.fn();
const mockDbExecute = vi.fn();

import { StatsService } from "../../src/services/stats-service.js";

function createService() {
  return new StatsService({
    // db.select() returns an object whose .from() is a terminal that returns a Promise.
    // This matches the usage: `await this.database.db.select({count:count()}).from(table)`
    database: {
      db: {
        select: vi.fn().mockReturnValue({ from: mockDbFrom }),
        execute: mockDbExecute,
      },
    } as any,
    sourceService: { getTotalSourceCount: mockGetTotalSourceCount } as any,
    jobService: {
      getTotalJobCount: mockGetTotalJobCount,
      getAvgImportDuration: mockGetAvgImportDuration,
    } as any,
  });
}

describe("StatsService", () => {
  let service: StatsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
  });

  it("aggregates counts from sourceService, jobService, and ORM queries", async () => {
    mockGetTotalSourceCount.mockResolvedValue(3);
    mockGetTotalJobCount.mockResolvedValue(12);
    mockGetAvgImportDuration.mockResolvedValue(4200);

    // from() is called three times (docs, chunks, embeddings) — sequenced via Once
    mockDbFrom
      .mockResolvedValueOnce([{ count: 10 }])   // docs
      .mockResolvedValueOnce([{ count: 50 }])   // chunks
      .mockResolvedValueOnce([{ count: 45 }]);  // embeddings

    mockDbExecute.mockResolvedValue({ rows: [{ bytes: 9000 }] });

    const result = await service.getStats();

    expect(result).toEqual({
      totalSources: 3,
      totalDocs: 10,
      totalChunks: 50,
      totalEmbeddings: 45,
      totalJobs: 12,
      avgImportDurationMs: 4200,
      storageBytes: 9000,
    });
  });

  it("queries docs, chunks, and embeddings counts via the ORM", async () => {
    mockGetTotalSourceCount.mockResolvedValue(0);
    mockGetTotalJobCount.mockResolvedValue(0);
    mockGetAvgImportDuration.mockResolvedValue(0);
    mockDbFrom.mockResolvedValue([{ count: 0 }]);
    mockDbExecute.mockResolvedValue({ rows: [{ bytes: 0 }] });

    await service.getStats();

    // select().from() called 3 times (docs, chunks, embeddings)
    expect(mockDbFrom).toHaveBeenCalledTimes(3);
    // execute() called once for the SUM(LENGTH(...)) query
    expect(mockDbExecute).toHaveBeenCalledTimes(1);
  });

  it("returns zeroed stats when there is no data", async () => {
    mockGetTotalSourceCount.mockResolvedValue(0);
    mockGetTotalJobCount.mockResolvedValue(0);
    mockGetAvgImportDuration.mockResolvedValue(0);
    mockDbFrom
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }]);
    mockDbExecute.mockResolvedValue({ rows: [{ bytes: 0 }] });

    const result = await service.getStats();

    expect(result).toEqual({
      totalSources: 0,
      totalDocs: 0,
      totalChunks: 0,
      totalEmbeddings: 0,
      totalJobs: 0,
      avgImportDurationMs: 0,
      storageBytes: 0,
    });
  });
});
