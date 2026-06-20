import { crawlUrl } from "../crawler/crawler.js";
import { parseLlmsTxt, extractUrls } from "../crawler/llmstxt-parser.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";
import { db, query, pool } from "../db/pool.js";
import type { Database } from "../db/database.js";

const CONCURRENCY = 3;

const _defaultDb = {
  db, query, pool,
  getClient: async () => pool.connect(),
  end: async () => { await pool.end(); },
} as unknown as Database;

const _defaultChunkService = new ChunkService({ database: _defaultDb });

export class LlmsTxtCrawlImporter implements Importer {
  readonly type = "llmstxt-crawl";
  private chunkService: ChunkService;

  constructor(
    { chunkService }: { chunkService: ChunkService } = { chunkService: _defaultChunkService },
  ) {
    this.chunkService = chunkService;
  }

  async import(source: Source): Promise<ImportResult> {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`Failed to fetch ${source.url}: ${res.status}`);

    const content = await res.text();
    const metadata = parseLlmsTxt(content);
    const includeOptional = this.parseOptional(source.config);
    const urls = extractUrls(metadata, includeOptional);

    if (urls.length === 0) return { docCount: 0, chunkCount: 0 };

    const allChunks: Array<{
      docUrl: string;
      docTitle: string | undefined;
      content: string;
      heading: string | undefined;
      headingPath: string[];
      chunkIndex: number;
    }> = [];

    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      const batch = urls.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((u) => crawlUrl(u)),
      );
      for (const result of results) allChunks.push(...result.chunks);
    }

    if (allChunks.length === 0) return { docCount: 0, chunkCount: 0 };

    const saved = await this.chunkService.saveChunks(allChunks, source.id);
    return saved;
  }

  private parseOptional(configStr: string | null): boolean {
    if (!configStr) return false;
    try {
      return JSON.parse(configStr).includeOptional ?? false;
    } catch {
      return false;
    }
  }
}
