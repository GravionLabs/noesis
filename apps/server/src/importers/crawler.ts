import { crawlUrl, normalizeCrawlConfig } from "../crawler/crawler.js";
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

export class CrawlerImporter implements Importer {
  readonly type = "crawler";
  private chunkService: ChunkService;

  constructor(
    { chunkService }: { chunkService: ChunkService } = { chunkService: _defaultChunkService },
  ) {
    this.chunkService = chunkService;
  }

  async import(source: Source): Promise<ImportResult> {
    const sourceConfig = source.config ? JSON.parse(source.config) : {};
    const crawlConfig = normalizeCrawlConfig(sourceConfig);

    const result = await crawlUrl(source.url, crawlConfig);
    if (result.chunks.length === 0) return { docCount: 0, chunkCount: 0 };

    const saved = await this.chunkService.saveChunks(result.chunks, source.id);
    return saved;
  }
}
