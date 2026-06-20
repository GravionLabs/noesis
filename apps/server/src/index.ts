import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import apiReference from "@scalar/fastify-api-reference";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { pool } from "./db/pool.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerSourceRoutes } from "./routes/sources.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerInternalRoutes } from "./routes/internal.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerSearchRoutes } from "./routes/search.js";
import { createMcpServer } from "./mcp/handler.js";
import { startScheduler } from "./pipeline/scheduler.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireApiKey } from "./middleware/auth.js";

async function main() {
  logger.info({ port: config.PORT, database: config.DATABASE_URL, embeddingProvider: config.EMBEDDING_PROVIDER, embeddingModel: config.EMBEDDING_MODEL }, "Noesis server starting");

  // Verify database connectivity
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    logger.info("Database connection verified");
  } catch (err) {
    logger.fatal({ err }, "Database connection failed");
    process.exit(1);
  }

  const app = Fastify({ logger: true });

  // ---- Plugins ----
  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Noesis API",
        description: "Self-hosted documentation context engine",
        version: "0.1.0",
      },
    },
  });
  await app.register(apiReference, {
    routePrefix: "/openapi",
  });

  // ---- REST API Routes ----
  registerHealthRoutes(app);
  registerSourceRoutes(app);
  registerJobRoutes(app);
  registerInternalRoutes(app);
  registerStatsRoutes(app);
  registerSearchRoutes(app);

  // ---- MCP Server (Streamable HTTP) ----
  const mcpServer = createMcpServer();
  const mcpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: crypto.randomUUID.bind(crypto),
  });

  app.all("/mcp", { preHandler: requireApiKey }, async (req, reply) => {
    // CORS handled by @fastify/cors for all origins
    const rawReq = req.raw;
    const rawRes = reply.raw;
    try {
      await mcpTransport.handleRequest(rawReq, rawRes, req.body);
    } catch (err) {
      app.log.error({ err }, "MCP transport error");
      if (!rawRes.headersSent) {
        reply.code(500).send({ error: "Internal MCP error" });
      }
    }
  });

  await mcpServer.connect(mcpTransport);
  logger.info("MCP server ready at /mcp");

  // ---- Scheduler ----
  startScheduler();

  // ---- Startup ----
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  logger.info({ port: config.PORT }, "Noesis server listening");

  // ---- Graceful shutdown ----
  const shutdown = async () => {
    logger.info("Shutdown signal received, shutting down gracefully");
    await mcpServer.close();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, "Fatal startup error");
  process.exit(1);
});
