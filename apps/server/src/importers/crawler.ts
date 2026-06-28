import { crawlUrl, normalizeCrawlConfig } from "../crawler/crawler.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";

export class CrawlerImporter implements Importer {
  readonly type = "crawler";
  private chunkService: ChunkService;

  constructor({ chunkService }: { chunkService: ChunkService }) {
    this.chunkService = chunkService;
  }

  async import(source: Source, signal?: AbortSignal): Promise<ImportResult> {
    const sourceConfig = source.config ? JSON.parse(source.config) : {};
    const crawlConfig = normalizeCrawlConfig(sourceConfig);

    if (crawlConfig.incremental) {
      crawlConfig.knownHashes = await this.chunkService.getDocHashes(source.id);
    }

    if (signal?.aborted) return { docCount: 0, chunkCount: 0 };

    const result = await crawlUrl(source.url, { ...crawlConfig, signal });
    if (result.chunks.length === 0) return { docCount: 0, chunkCount: 0 };

    const saved = await this.chunkService.saveChunks(result.chunks, source.id);
    const chunksDropped: { reason: string; count: number }[] = [];

    if (result.droppedCount > 0) {
      chunksDropped.push({ reason: "link_list_and_dedup", count: result.droppedCount });
    }
    if (result.stoppedReason) {
      chunksDropped.push({ reason: result.stoppedReason, count: 1 });
    }

    return {
      ...saved,
      ...(chunksDropped.length > 0 ? { chunksDropped } : {}),
      ...(result.skippedCount > 0 ? { skippedCount: result.skippedCount } : {}),
    };
  }
}
