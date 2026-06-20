import { Database } from "../db/database.js";
import type { SourceService } from "./source-service.js";
import type { JobService } from "./job-service.js";

export class StatsService {
  private database: Database;
  private sourceService: SourceService;
  private jobService: JobService;

  constructor({
    database,
    sourceService,
    jobService,
  }: {
    database: Database;
    sourceService: SourceService;
    jobService: JobService;
  }) {
    this.database = database;
    this.sourceService = sourceService;
    this.jobService = jobService;
  }

  async getStats() {
    const [totalSources, totalJobs, avgImportDurationMs] = await Promise.all([
      this.sourceService.getTotalSourceCount(),
      this.jobService.getTotalJobCount(),
      this.jobService.getAvgImportDuration(),
    ]);

    const [docResult, chunkResult, embedResult] = await Promise.all([
      this.database.query<{ count: number }>(
        "SELECT COUNT(*)::int AS count FROM docs",
      ),
      this.database.query<{ count: number }>(
        "SELECT COUNT(*)::int AS count FROM chunks",
      ),
      this.database.query<{ count: number }>(
        "SELECT COUNT(*)::int AS count FROM embeddings",
      ),
    ]);

    const totalDocs = docResult.rows[0].count;
    const totalChunks = chunkResult.rows[0].count;
    const totalEmbeddings = embedResult.rows[0].count;

    const sizeResult = await this.database.query<{ bytes: number }>(
      "SELECT COALESCE(SUM(LENGTH(content))::int, 0) AS bytes FROM chunks",
    );
    const storageBytes = sizeResult.rows[0].bytes;

    return {
      totalSources,
      totalDocs,
      totalChunks,
      totalEmbeddings,
      totalJobs,
      avgImportDurationMs,
      storageBytes,
    };
  }
}
