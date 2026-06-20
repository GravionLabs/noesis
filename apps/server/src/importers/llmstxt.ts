import { chunkMarkdown } from "./chunk-utils.js";
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

export class LlmsTxtImporter implements Importer {
  readonly type = "llmstxt";
  private chunkService: ChunkService;

  constructor(
    { chunkService }: { chunkService: ChunkService } = { chunkService: _defaultChunkService },
  ) {
    this.chunkService = chunkService;
  }

  async import(source: Source): Promise<ImportResult> {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`Failed to fetch ${source.url}: ${res.status}`);

    const text = await res.text();
    const rawChunks = chunkMarkdown(text);
    if (rawChunks.length === 0) return { docCount: 0, chunkCount: 0 };

    const title = text.match(/^#\s+(.+)/m)?.[1]?.trim() ?? new URL(source.url).hostname;

    const chunks: CrawlChunkData[] = rawChunks.map((c) => ({
      docUrl: source.url,
      docTitle: title,
      content: c.content,
      heading: c.heading,
      headingPath: c.headingPath,
      chunkIndex: c.chunkIndex,
      docContentMd: text,
    }));

    return this.chunkService.saveChunks(chunks, source.id);
  }
}
