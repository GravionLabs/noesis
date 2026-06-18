import type { FastifyInstance } from "fastify";
import { requireApiKey } from "../middleware/auth.js";
import { updateJobStatus } from "../services/job-service.js";
import { updateLastImported } from "../services/source-service.js";

export function registerInternalRoutes(app: FastifyInstance) {
  app.post<{
    Body: { jobId: string; sourceId: string; chunkCount?: number };
  }>("/api/internal/embed-completed", { preHandler: requireApiKey }, async (req, reply) => {
    const { jobId, sourceId } = req.body;
    await updateJobStatus(jobId, "done");
    await updateLastImported(sourceId);
    return reply.code(200).send({ status: "ok" });
  });
}
