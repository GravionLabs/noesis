import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn();
const mockGetTotalSourceCount = vi.fn();
const mockGetTotalJobCount = vi.fn();
const mockGetAvgImportDuration = vi.fn();

import { StatsService } from "../../src/services/stats-service.js";

function createService() {
  return new StatsService({
    database: { query: mockQuery } as any,
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

  it("aggregates counts from sourceService, jobService, and raw queries", async () => {
    mockGetTotalSourceCount.mockResolvedValue(3);
    mockGetTotalJobCount.mockResolvedValue(12);
    mockGetAvgImportDuration.mockResolvedValue(4200);

    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: 10 }] }) // docs
      .mockResolvedValueOnce({ rows: [{ count: 50 }] }) // chunks
      .mockResolvedValueOnce({ rows: [{ count: 45 }] }) // embeddings
      .mockResolvedValueOnce({ rows: [{ bytes: 9000 }] }); // storage size

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

  it("queries docs, chunks, and embeddings counts", async () => {
    mockGetTotalSourceCount.mockResolvedValue(0);
    mockGetTotalJobCount.mockResolvedValue(0);
    mockGetAvgImportDuration.mockResolvedValue(0);
    mockQuery.mockResolvedValue({ rows: [{ count: 0, bytes: 0 }] });

    await service.getStats();

    const queriedSql = mockQuery.mock.calls.map(([sql]) => sql as string);
    expect(queriedSql.some((sql) => sql.includes("FROM docs"))).toBe(true);
    expect(queriedSql.some((sql) => sql.includes("FROM chunks"))).toBe(true);
    expect(queriedSql.some((sql) => sql.includes("FROM embeddings"))).toBe(true);
  });

  it("returns zeroed stats when there is no data", async () => {
    mockGetTotalSourceCount.mockResolvedValue(0);
    mockGetTotalJobCount.mockResolvedValue(0);
    mockGetAvgImportDuration.mockResolvedValue(0);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ bytes: 0 }] });

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
