import type { FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.js";

export async function requireApiKey(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!config.API_KEY) return;
  const key = req.headers["x-api-key"];
  if (!key || key !== config.API_KEY) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}
