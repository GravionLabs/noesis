import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SearchService } from "../services/search-service.js";
import type { ChunkService } from "../services/chunk-service.js";
import type { SourceService } from "../services/source-service.js";
import type { ImportService } from "../services/import-service.js";
import type { JobService } from "../services/job-service.js";

export class McpHandler {
  private searchService: SearchService;
  private chunkService: ChunkService;
  private sourceService: SourceService;
  private importService: ImportService;
  private jobService: JobService;

  constructor({
    searchService,
    chunkService,
    sourceService,
    importService,
    jobService,
  }: {
    searchService: SearchService;
    chunkService: ChunkService;
    sourceService: SourceService;
    importService: ImportService;
    jobService: JobService;
  }) {
    this.searchService = searchService;
    this.chunkService = chunkService;
    this.sourceService = sourceService;
    this.importService = importService;
    this.jobService = jobService;
  }

  createServer() {
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
          const results = await this.searchService.searchDocs(searchQuery, limit, source);

          if (results.length === 0) {
            return {
              content: [{ type: "text" as const, text: "No results found." }],
            };
          }

          return {
            content: results.map((r: any) => ({
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
          const chunk = await this.chunkService.getChunkWithSource(chunkId);
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
          const sources = await this.sourceService.listSources();
          if (sources.length === 0) {
            return {
              content: [{ type: "text" as const, text: "No sources registered." }],
            };
          }

          return {
            content: sources.map((s: any) => ({
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

    server.tool(
      "import_source",
      "Trigger an import of a documentation source by its ID",
      {
        sourceId: z.string().describe("UUID of the source to import"),
      },
      async ({ sourceId }) => {
        try {
          const job: any = await this.importService.triggerImport(sourceId);
          return {
            content: [{
              type: "text" as const,
              text: [
                `Import triggered for source ${sourceId}.`,
                `Job ID: ${job.id}`,
                `Status: ${job.status}`,
              ].join("\n"),
            }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [{ type: "text" as const, text: `Import failed: ${message}` }],
            isError: true,
          };
        }
      },
    );

    server.tool(
      "get_job_status",
      "Get the status of an import job by its UUID",
      {
        jobId: z.string().describe("UUID of the job to query"),
      },
      async ({ jobId }) => {
        try {
          const job: any = await this.jobService.getJob(jobId);
          if (!job) {
            return {
              content: [{ type: "text" as const, text: `Job ${jobId} not found.` }],
              isError: true,
            };
          }

          return {
            content: [{
              type: "text" as const,
              text: [
                `Job ID: ${job.id}`,
                `Type: ${job.type}`,
                `Source ID: ${job.sourceId}`,
                `Status: ${job.status}`,
                job.error ? `Error: ${job.error}` : "",
                job.startedAt ? `Started: ${job.startedAt.toISOString()}` : "",
                job.finishedAt ? `Finished: ${job.finishedAt.toISOString()}` : "",
                `Created: ${job.createdAt.toISOString()}`,
              ].filter(Boolean).join("\n"),
            }],
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
}
