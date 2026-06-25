import type { FastifyInstance } from "fastify";
import type { JobService } from "../services/job-service.js";
import type { ImportService } from "../services/import-service.js";
import { jobEvents, type JobStatusEvent } from "../pipeline/job-events.js";

const SSE_HEARTBEAT_MS = 15_000;

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

  /**
   * GET /api/jobs/stream — Server-Sent Events stream for real-time job status.
   *
   * Intentionally unauthenticated: all other /api/jobs* routes are also open,
   * and browser-native EventSource cannot set custom headers (X-Api-Key), so
   * adding requireApiKey here would require a query-param key workaround.
   *
   * Scope note: the in-process EventEmitter only works for a single server
   * instance. Horizontal scaling would require a shared pub/sub layer.
   */
  app.get("/api/jobs/stream", async (req, reply) => {
    const raw = reply.raw;

    raw.setHeader("Content-Type", "text/event-stream");
    raw.setHeader("Cache-Control", "no-cache");
    raw.setHeader("Connection", "keep-alive");
    raw.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering
    raw.flushHeaders();

    const send = (event: JobStatusEvent) => {
      raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const heartbeat = setInterval(() => {
      raw.write(`:ping\n\n`);
    }, SSE_HEARTBEAT_MS);

    jobEvents.on("job", send);

    req.raw.on("close", () => {
      clearInterval(heartbeat);
      jobEvents.off("job", send);
    });

    // Keep the request open — do not call reply.send()
    await new Promise<void>((resolve) => req.raw.on("close", resolve));
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
