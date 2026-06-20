import type { FastifyInstance } from "fastify";
import { query } from "../db/pool.js";
import { getTotalSourceCount } from "../services/source-service.js";
import {
  getTotalJobCount,
  getAvgImportDuration,
} from "../services/job-service.js";

const statsSchema = {
  tags: ["Stats"],
  response: {
    200: {
      type: "object",
      properties: {
        totalSources: { type: "integer" },
        totalDocs: { type: "integer" },
        totalChunks: { type: "integer" },
        totalEmbeddings: { type: "integer" },
        totalJobs: { type: "integer" },
        avgImportDurationMs: { type: "integer" },
        storageBytes: { type: "integer" },
      },
    },
  },
};

export function registerStatsRoutes(app: FastifyInstance) {
  app.get("/api/stats", { schema: statsSchema }, async () => {
    const [totalSources, totalJobs, avgImportDurationMs] = await Promise.all([
      getTotalSourceCount(),
      getTotalJobCount(),
      getAvgImportDuration(),
    ]);

    const [docResult, chunkResult, embedResult] = await Promise.all([
      query<{ count: number }>("SELECT COUNT(*)::int AS count FROM docs"),
      query<{ count: number }>("SELECT COUNT(*)::int AS count FROM chunks"),
      query<{ count: number }>(
        "SELECT COUNT(*)::int AS count FROM embeddings",
      ),
    ]);

    const totalDocs = docResult.rows[0].count;
    const totalChunks = chunkResult.rows[0].count;
    const totalEmbeddings = embedResult.rows[0].count;

    const sizeResult = await query<{ bytes: number }>(
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
  });
}
