import type { FastifyInstance } from "fastify";
import { getJob, listJobs } from "../services/job-service.js";

const jobObject = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    sourceId: { type: "string", format: "uuid", nullable: true },
    type: { type: "string" },
    status: { type: "string" },
    error: { type: "string", nullable: true },
    startedAt: { type: "string", format: "date-time", nullable: true },
    finishedAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

const listJobsSchema = {
  tags: ["Jobs"],
  response: {
    200: {
      type: "array",
      items: jobObject,
    },
  },
};

const getJobSchema = {
  tags: ["Jobs"],
  params: {
    type: "object",
    properties: { id: { type: "string", format: "uuid" } },
    required: ["id"],
  },
  response: {
    200: jobObject,
    404: {
      type: "object",
      properties: { error: { type: "string" } },
    },
  },
};

export function registerJobRoutes(app: FastifyInstance) {
  app.get("/api/jobs", { schema: listJobsSchema }, async (_req, reply) => {
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
    { schema: getJobSchema },
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
