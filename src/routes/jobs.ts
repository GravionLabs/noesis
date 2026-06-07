import type { FastifyInstance } from "fastify";
import { getJob, listJobs } from "../services/job-service.js";

export function registerJobRoutes(app: FastifyInstance) {
  app.get("/api/jobs", async (_req, reply) => {
    const jobs = await listJobs();
    return jobs.map((j) => ({
      id: j.id,
      sourceId: j.sourceId,
      type: j.type,
      status: j.status,
      error: j.error,
      startedAt: j.startedAt,
      finishedAt: j.finishedAt,
      createdAt: j.createdAt,
    }));
  });

  app.get<{ Params: { id: string } }>(
    "/api/jobs/:id",
    async (req, reply) => {
      const job = await getJob(req.params.id);
      if (!job) return reply.code(404).send({ error: "Job not found" });
      return {
        id: job.id,
        sourceId: job.sourceId,
        type: job.type,
        status: job.status,
        error: job.error,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        createdAt: job.createdAt,
      };
    },
  );
}
