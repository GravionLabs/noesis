import { Database } from "../db/database.js";
import { config } from "../config.js";
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

import { Database as ShimDb } from "../db/database.js";
import { SourceService as ShimSource } from "./source-service.js";
import { JobService as ShimJob } from "./job-service.js";

const _shimDb = new ShimDb({ config });
const _shimSource = new ShimSource({ database: _shimDb });
const _shimJob = new ShimJob({ database: _shimDb });
const _shim = new StatsService({
  database: _shimDb,
  sourceService: _shimSource,
  jobService: _shimJob,
});

export const getStats = _shim.getStats.bind(_shim);
