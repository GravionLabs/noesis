import type { FastifyInstance } from "fastify";
import { createRequireApiKey } from "../middleware/auth.js";
import type { JobService } from "../services/job-service.js";
import type { SourceService } from "../services/source-service.js";
import type { Config } from "../config/index.js";

export function registerInternalRoutes(
  app: FastifyInstance,
  deps: { jobService: JobService; sourceService: SourceService; config: Config },
) {
  app.post<{
    Body: { jobId: string; sourceId: string; chunkCount?: number };
  }>("/api/internal/embed-completed", {
    preHandler: createRequireApiKey({ config: deps.config }),
  }, async (req, reply) => {
    const { jobId, sourceId } = req.body;
    await deps.jobService.updateJobStatus(jobId, "done");
    await deps.sourceService.updateLastImported(sourceId);
    return reply.code(200).send({ status: "ok" });
  });
}
