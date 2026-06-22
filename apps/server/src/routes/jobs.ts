import type { FastifyInstance } from "fastify";
import type { JobService } from "../services/job-service.js";
import type { ImportService } from "../services/import-service.js";

export function registerJobRoutes(
  app: FastifyInstance,
  deps: { jobService: JobService; importService: ImportService },
) {
  const { jobService, importService } = deps;

  app.get("/api/jobs", async (_req, reply) => {
    const jobs = await jobService.listJobs();
    return jobs.map((j) => ({
      id: j.id,
      sourceId: j.sourceId,
      type: j.type,
      status: j.status,
      error: j.error,
      retryCount: j.retryCount,
      maxRetries: j.maxRetries,
      durationMs: j.durationMs,
      startedAt: j.startedAt,
      finishedAt: j.finishedAt,
      createdAt: j.createdAt,
    }));
  });

  app.get<{ Params: { id: string } }>(
    "/api/jobs/:id",
    async (req, reply) => {
      const job = await jobService.getJob(req.params.id);
      if (!job) return reply.code(404).send({ error: "Job not found" });
      return {
        id: job.id,
        sourceId: job.sourceId,
        type: job.type,
        status: job.status,
        error: job.error,
        retryCount: job.retryCount,
        maxRetries: job.maxRetries,
        durationMs: job.durationMs,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        createdAt: job.createdAt,
      };
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/jobs/:id/retry",
    async (req, reply) => {
      const job = await jobService.getJob(req.params.id);
      if (!job) return reply.code(404).send({ error: "Job not found" });
      if (job.status !== "failed") return reply.code(400).send({ error: "Only failed jobs can be retried" });
      if (!job.sourceId) return reply.code(400).send({ error: "Job has no source reference" });

      try {
        const newJob: any = await importService.triggerImport(job.sourceId);
        return reply.code(202).send({ jobId: newJob.id, status: "accepted" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.code(404).send({ error: message });
      }
    },
  );
}
