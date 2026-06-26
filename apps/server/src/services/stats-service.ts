/**
 * StatsService — aggregated platform-wide statistics.
 *
 * Tables (read): sources, docs, chunks, embeddings, jobs (via service delegates)
 * DB access: Drizzle ORM count() for table totals; sql tagged template for
 *   functions not covered by ORM helpers (COALESCE, SUM, LENGTH).
 * Dependencies: delegates source/job counts to SourceService and JobService
 *   to avoid duplicating query logic.
 */
import { count, sql } from "drizzle-orm";
import { docs, chunks, embeddings } from "../db/schema.js";
import type { Database } from "../db/database.js";
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

    const [docR, chunkR, embedR] = await Promise.all([
      this.database.db.select({ count: count() }).from(docs),
      this.database.db.select({ count: count() }).from(chunks),
      this.database.db.select({ count: count() }).from(embeddings),
    ]);

    const sizeR = await this.database.db.execute<{ bytes: number }>(
      sql`SELECT COALESCE(SUM(LENGTH(${chunks.content}))::int, 0) AS bytes FROM ${chunks}`,
    );

    return {
      totalSources,
      totalDocs: Number(docR[0].count),
      totalChunks: Number(chunkR[0].count),
      totalEmbeddings: Number(embedR[0].count),
      totalJobs,
      avgImportDurationMs,
      storageBytes: (sizeR.rows[0]?.bytes as number) ?? 0,
    };
  }
}
