import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import apiReference from "@scalar/fastify-api-reference";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { buildContainer } from "./container.js";
import { registerHealthzRoutes } from "./routes/healthz.js";
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
  registerHealthzRoutes(app, cradle);
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
        u.startsWith("/healthz") ||
        u.startsWith("/openapi")
      ) {
        return reply.code(404).send({ error: "Not found" });
      }
      return reply.sendFile("index.html");
    });

    logger.info({ root: uiRoot }, "Serving Angular UI");
  }

  // ---- MCP Server (Streamable HTTP) ----
  // Each client session gets its own McpServer + transport pair, keyed by the
  // `mcp-session-id` header the SDK assigns on `initialize`. A single shared
  // transport can only ever complete one `initialize` handshake for the life
  // of the process — every later client (e.g. reconnecting in MCP Inspector)
  // would get rejected with "Server already initialized".
  const mcpTransports = new Map<string, StreamableHTTPServerTransport>();

  app.all("/mcp", { preHandler: requireApiKey }, async (req, reply) => {
    const rawReq = req.raw;
    const rawRes = reply.raw;
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    try {
      let transport = sessionId ? mcpTransports.get(sessionId) : undefined;

      if (!transport) {
        if (sessionId || !isInitializeRequest(req.body)) {
          reply.code(400).send({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Bad Request: No valid session ID provided" },
            id: null,
          });
          return;
        }

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: crypto.randomUUID.bind(crypto),
          onsessioninitialized: (newSessionId) => {
            mcpTransports.set(newSessionId, transport!);
          },
        });
        transport.onclose = () => {
          if (transport!.sessionId) mcpTransports.delete(transport!.sessionId);
        };

        await mcpHandler.createServer().connect(transport);
      }

      await transport.handleRequest(rawReq, rawRes, req.body);
    } catch (err) {
      app.log.error({ err }, "MCP transport error");
      if (!rawRes.headersSent) {
        reply.code(500).send({ error: "Internal MCP error" });
      }
    }
  });

  logger.info("MCP server ready at /mcp");

  // ---- Scheduler ----
  scheduler.startScheduler();

  // ---- Startup ----
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  logger.info({ port: config.PORT }, "Noesis server listening");

  // ---- Graceful shutdown ----
  const shutdown = async () => {
    logger.info("Shutdown signal received, shutting down gracefully");
    await Promise.all([...mcpTransports.values()].map((transport) => transport.close()));
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
