import { crawlUrl, normalizeCrawlConfig } from "../crawler/crawler.js";
import { saveChunks } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";

export class CrawlerImporter implements Importer {
  readonly type = "crawler";

  async import(source: Source): Promise<ImportResult> {
    const sourceConfig = source.config ? JSON.parse(source.config) : {};
    const crawlConfig = normalizeCrawlConfig(sourceConfig);

    const result = await crawlUrl(source.url, crawlConfig);
    if (result.chunks.length === 0) return { docCount: 0, chunkCount: 0 };

    const saved = await saveChunks(result.chunks, source.id);
    return saved;
  }
}
