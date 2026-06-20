import type { CrawlChunkData } from "../services/chunk-service.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";
import { db, query, pool } from "../db/pool.js";
import type { Database } from "../db/database.js";

const _defaultDb = {
  db, query, pool,
  getClient: async () => pool.connect(),
  end: async () => { await pool.end(); },
} as unknown as Database;

const _defaultChunkService = new ChunkService({ database: _defaultDb });

interface OpenApiSpec {
  info?: { title?: string; description?: string };
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
}

export class OpenApiImporter implements Importer {
  readonly type = "openapi";
  private chunkService: ChunkService;

  constructor(
    { chunkService }: { chunkService: ChunkService } = { chunkService: _defaultChunkService },
  ) {
    this.chunkService = chunkService;
  }

  async import(source: Source): Promise<ImportResult> {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`Failed to fetch ${source.url}: ${res.status}`);

    const spec = (await res.json()) as OpenApiSpec;
    const title = spec.info?.title ?? new URL(source.url).hostname;
    const specJson = JSON.stringify(spec, null, 2);
    const paths = spec.paths ?? {};

    const operations: Array<{ method: string; path: string; op: OpenApiOperation }> = [];

    for (const [path, methods] of Object.entries(paths)) {
      for (const method of ["get", "post", "put", "patch", "delete", "options", "head"] as const) {
        const op = methods?.[method];
        if (op) operations.push({ method, path, op });
      }
    }

    if (operations.length === 0) return { docCount: 1, chunkCount: 0 };

    const chunks: CrawlChunkData[] = operations.map(({ method, path, op }, i) => {
      const content = [
        `## ${method.toUpperCase()} ${path}`,
        op.summary ? `**${op.summary}**` : "",
        op.description ?? "",
        op.operationId ? `Operation ID: ${op.operationId}` : "",
        op.tags?.length ? `Tags: ${op.tags.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      return {
        docUrl: source.url,
        docTitle: title,
        content,
        heading: `${method.toUpperCase()} ${path}`,
        headingPath: [title, `${method.toUpperCase()} ${path}`],
        chunkIndex: i,
        docContentMd: specJson,
      };
    });

    return this.chunkService.saveChunks(chunks, source.id);
  }
}
