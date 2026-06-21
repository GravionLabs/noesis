import type { FastifyRequest, FastifyReply } from "fastify";
import type { Config } from "../config/index.js";

export function createRequireApiKey({ config }: { config: Config }) {
  return async function requireApiKey(
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!config.API_KEY) return;
    const key = req.headers["x-api-key"];
    if (!key || key !== config.API_KEY) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  };
}
