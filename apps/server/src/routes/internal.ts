import type { FastifyInstance } from "fastify";
import { requireApiKey } from "../middleware/auth.js";
import type { JobService } from "../services/job-service.js";
import type { SourceService } from "../services/source-service.js";

export function registerInternalRoutes(
  app: FastifyInstance,
  deps: { jobService: JobService; sourceService: SourceService },
) {
  app.post<{
    Body: { jobId: string; sourceId: string; chunkCount?: number };
  }>("/api/internal/embed-completed", {
    preHandler: requireApiKey,
  }, async (req, reply) => {
    const { jobId, sourceId } = req.body;
    await deps.jobService.updateJobStatus(jobId, "done");
    await deps.sourceService.updateLastImported(sourceId);
    return reply.code(200).send({ status: "ok" });
  });
}
