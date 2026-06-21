import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import apiReference from "@scalar/fastify-api-reference";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildContainer } from "./container.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerSourceRoutes } from "./routes/sources.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerInternalRoutes } from "./routes/internal.js";
import { registerStatsRoutes } from "./routes/stats.js";
import { registerSearchRoutes } from "./routes/search.js";
import { createRequireApiKey } from "./middleware/auth.js";

const container = buildContainer();
const cradle = container.cradle as any;
const { config, database, scheduler, mcpHandler } = cradle;
const logger = cradle.logger;
const requireApiKey = createRequireApiKey({ config });

async function main() {
  logger.info({ port: config.PORT, database: config.DATABASE_URL, embeddingProvider: config.EMBEDDING_PROVIDER, embeddingModel: config.EMBEDDING_MODEL }, "Noesis server starting");

  // Verify database connectivity
  try {
    const client = await database.getClient();
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
  registerHealthRoutes(app, cradle);
  registerSourceRoutes(app, cradle);
  registerJobRoutes(app, cradle);
  registerInternalRoutes(app, cradle);
  registerStatsRoutes(app, cradle);
  registerSearchRoutes(app, cradle);

  // ---- Static UI serving ----
  if (config.SERVE_UI) {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const uiRoot = resolve(__dirname, config.UI_DIST_PATH ?? "../../ui/dist/ui/browser");

    await app.register(fastifyStatic, {
      root: uiRoot,
      prefix: "/",
      wildcard: false,
    });

    app.setNotFoundHandler((req, reply) => {
      const u = req.url;
      if (
        u.startsWith("/api") ||
        u.startsWith("/mcp") ||
        u.startsWith("/health") ||
        u.startsWith("/alive") ||
        u.startsWith("/openapi")
      ) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.sendFile("index.html");
    });

    logger.info({ root: uiRoot }, "Serving Angular UI");
  }

  // ---- MCP Server (Streamable HTTP) ----
  const mcpServer = mcpHandler.createServer();
  const mcpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: crypto.randomUUID.bind(crypto),
  });

  app.all("/mcp", { preHandler: requireApiKey }, async (req, reply) => {
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
  scheduler.startScheduler();

  // ---- Startup ----
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  logger.info({ port: config.PORT }, "Noesis server listening");

  // ---- Graceful shutdown ----
  const shutdown = async () => {
    logger.info("Shutdown signal received, shutting down gracefully");
    await mcpServer.close();
    await database.end();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, "Fatal startup error");
  process.exit(1);
});
