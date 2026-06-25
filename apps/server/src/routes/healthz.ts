import type { FastifyInstance } from "fastify";
import type { Config } from "../config/index.js";
import type { Scheduler } from "../pipeline/scheduler.js";
import type { JobService } from "../services/job-service.js";
import type { SourceService } from "../services/source-service.js";

export function registerHealthzRoutes(
  app: FastifyInstance,
  deps: { config: Config; scheduler: Scheduler; jobService: JobService; sourceService: SourceService },
) {
  app.get("/healthz/live", async () => ({ status: "alive" }));

  app.get("/healthz/ready", async () => ({
    status: "ok",
    provider: deps.config.EMBEDDING_PROVIDER,
    model: deps.config.EMBEDDING_MODEL,
    dimensions: deps.config.EMBEDDING_DIMENSIONS,
    schedulerRunning: deps.scheduler.isSchedulerRunning(),
    pendingJobs: await deps.jobService.getPendingJobCount(),
    totalSources: await deps.sourceService.getTotalSourceCount(),
  }));
}
