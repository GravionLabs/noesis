import Fastify from "fastify";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerSourceRoutes } from "./routes/sources.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerInternalRoutes } from "./routes/internal.js";
import { createMcpServer } from "./mcp/handler.js";
import { startRabbitConsumers } from "./services/import-service.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

async function main() {
  console.log("Noesis server starting...");
  console.log("  Port: %d", config.PORT);
  console.log("  Database: %s", config.DATABASE_URL);
  console.log("  RabbitMQ: %s", config.RABBITMQ_URL);
  console.log("  Embedding: %s (%s)", config.EMBEDDING_PROVIDER, config.EMBEDDING_MODEL);

  // Verify database connectivity
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log("  Database: connected");
  } catch (err) {
    console.error("  Database: connection failed", err);
    process.exit(1);
  }

  const app = Fastify({ logger: true });

  // ---- REST API Routes ----
  registerHealthRoutes(app);
  registerSourceRoutes(app);
  registerJobRoutes(app);
  registerInternalRoutes(app);

  // ---- MCP Server (Streamable HTTP) ----
  const mcpServer = createMcpServer();
  const mcpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: crypto.randomUUID.bind(crypto),
  });

  app.all("/mcp", async (req, reply) => {
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
  console.log("  MCP server: ready at /mcp");

  // ---- RabbitMQ Consumers ----
  try {
    await startRabbitConsumers();
  } catch (err) {
    app.log.warn({ err }, "RabbitMQ consumers not started — will retry on next import");
  }

  // ---- Startup ----
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  console.log("\nNoesis server ready on port %d", config.PORT);

  // ---- Graceful shutdown ----
  const shutdown = async () => {
    console.log("\nShutting down...");
    await mcpServer.close();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
