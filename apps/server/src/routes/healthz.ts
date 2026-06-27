import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import type { Config } from "../config/index.js";
import type { Database } from "../db/database.js";
import type { Scheduler } from "../pipeline/scheduler.js";
import type { EmbeddingService } from "../services/embedding-service.js";
import type { JobService } from "../services/job-service.js";
import type { SourceService } from "../services/source-service.js";

export function registerHealthzRoutes(
  app: FastifyInstance,
  {
    config,
    database,
    scheduler,
    embeddingService,
    jobService,
    sourceService,
  }: { config: Config; database: Database; scheduler: Scheduler; embeddingService: EmbeddingService; jobService: JobService; sourceService: SourceService },
) {
  app.get("/healthz/live", async () => ({ status: "alive" }));

  app.get("/healthz/ready", async (req, reply) => {
    const checks: Record<string, string> = {};

    try {
      await database.db.execute(sql`SELECT 1`);
    } catch {
      checks.db = "unreachable";
    }

    try {
      const healthy = await embeddingService.getProvider().health();
      if (!healthy) checks.embedding = "unreachable";
    } catch {
      checks.embedding = "unreachable";
    }

    const degraded = Object.keys(checks).length > 0;

    const body = {
      status: degraded ? "degraded" : "ok",
      ...checks,
      provider: config.EMBEDDING_PROVIDER,
      model: config.EMBEDDING_MODEL,
      dimensions: config.EMBEDDING_DIMENSIONS,
      schedulerRunning: scheduler.isSchedulerRunning(),
      schedulerLeader: scheduler.isLeader(),
      pendingJobs: await jobService.getPendingJobCount(),
      totalSources: await sourceService.getTotalSourceCount(),
    };

    if (degraded) {
      return reply.code(503).send(body);
    }

    return body;
  });
}
