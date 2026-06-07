import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchChunks } from "../services/search-service.js";
import { getChunkWithSource } from "../services/chunk-service.js";
import { listSources } from "../services/source-service.js";

export function createMcpServer() {
  const server = new McpServer(
    {
      name: "noesis",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.tool(
    "search_docs",
    "Semantic similarity search over all indexed documentation chunks",
    {
      query: z.string().describe("The search query text"),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of results (default: 10)"),
      source: z
        .string()
        .optional()
        .describe("Filter by source name (optional)"),
    },
    async ({ query: searchQuery, limit, source }) => {
      try {
        const { embedText } = await import("../services/embedding-service.js");
        const vector = await embedText(searchQuery);

        const results = await searchChunks(vector, limit, source);

        return {
          content: results.map((r) => ({
            type: "text" as const,
            text: [
              `[${r.sourceName}] ${r.docTitle ?? r.docUrl}`,
              r.heading ? `## ${r.heading}` : "",
              r.content.slice(0, 500),
              `Score: ${(r.score * 100).toFixed(1)}%`,
              `Chunk: ${r.chunkId}`,
            ]
              .filter(Boolean)
              .join("\n"),
          })),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Search failed: ${message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "get_chunk",
    "Retrieve a specific documentation chunk by its UUID",
    {
      chunkId: z.string().describe("UUID of the chunk to retrieve"),
    },
    async ({ chunkId }) => {
      try {
        const chunk = await getChunkWithSource(chunkId);
        if (!chunk) {
          return {
            content: [{ type: "text" as const, text: `Chunk ${chunkId} not found` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: [
                `Source: ${chunk.sourceName}`,
                `Doc: ${chunk.docTitle ?? chunk.docUrl}`,
                chunk.heading ? `Heading: ${chunk.heading}` : "",
                `Content:\n${chunk.content}`,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );

  server.tool(
    "list_sources",
    "List all registered documentation sources",
    {},
    async () => {
      try {
        const sources = await listSources();
        if (sources.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No sources registered." }],
          };
        }

        return {
          content: sources.map((s) => ({
            type: "text" as const,
            text: [
              `ID: ${s.id}`,
              `Name: ${s.name}`,
              `URL: ${s.url}`,
              `Type: ${s.importerType}`,
              `Enabled: ${s.enabled}`,
              s.lastImportedAt
                ? `Last imported: ${s.lastImportedAt.toISOString()}`
                : "Not yet imported",
            ].join("\n"),
          })),
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text" as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    },
  );

  return server;
}
