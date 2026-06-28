import { crawlUrl } from "../crawler/crawler.js";
import type { CrawlConfig } from "../crawler/crawler.js";
import { parseLlmsTxt, extractUrls } from "../crawler/llmstxt-parser.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";
import { fetchOrThrow } from "../utils/fetch.js";
const CONCURRENCY = 3;

const MAX_CONSECUTIVE_FAILURES = 10;

export class LlmsTxtCrawlImporter implements Importer {
  readonly type = "llmstxt-crawl";
  private chunkService: ChunkService;

  constructor({ chunkService }: { chunkService: ChunkService }) {
    this.chunkService = chunkService;
  }

  async import(source: Source, signal?: AbortSignal): Promise<ImportResult> {
    if (signal?.aborted) return { docCount: 0, chunkCount: 0 };

    const res = await fetchOrThrow(source.url);

    const content = await res.text();
    const metadata = parseLlmsTxt(content);
    const parsedConfig = this.parseConfig(source.config);
    const { crawlConfig, includeOptional } = parsedConfig;
    const urls = extractUrls(metadata, includeOptional);

    if (urls.length === 0) return { docCount: 0, chunkCount: 0 };

    let totalDocCount = 0;
    let totalChunkCount = 0;
    const chunksDropped: { reason: string; count: number }[] = [];
    let consecutiveFailures = 0;

    for (let i = 0; i < urls.length && !signal?.aborted; i += CONCURRENCY) {
      const batch = urls.slice(i, i + CONCURRENCY);

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        chunksDropped.push({ reason: "too_many_consecutive_failures", count: urls.length - i });
        break;
      }

      const results = await Promise.allSettled(
        batch.map((u) => crawlUrl(u, { ...crawlConfig, signal })),
      );

      const batchChunks: Array<{
        docUrl: string;
        docTitle: string | undefined;
        content: string;
        heading: string | undefined;
        headingPath: string[];
        chunkIndex: number;
      }> = [];

      let batchFailedCount = 0;
      for (const result of results) {
        if (result.status === "fulfilled") {
          batchChunks.push(...result.value.chunks);
          consecutiveFailures = 0;
        } else {
          batchFailedCount++;
          consecutiveFailures++;
          const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
          console.warn(`llmstxt-crawl: URL crawl failed: ${msg}`);
        }
      }

      if (batchFailedCount === batch.length) {
        chunksDropped.push({ reason: "crawl_error", count: batch.length });
      }

      if (batchChunks.length > 0) {
        const saved = await this.chunkService.saveChunks(batchChunks, source.id);
        totalDocCount += saved.docCount;
        totalChunkCount += saved.chunkCount;
      }
    }

    if (signal?.aborted) {
      chunksDropped.push({ reason: "cancelled", count: urls.length });
    }

    return {
      docCount: totalDocCount,
      chunkCount: totalChunkCount,
      ...(chunksDropped.length > 0 ? { chunksDropped } : {}),
    };
  }

  private parseConfig(configStr: string | null): { crawlConfig: CrawlConfig; includeOptional: boolean } {
    if (!configStr) return { crawlConfig: {}, includeOptional: false };
    try {
      const parsed = JSON.parse(configStr);
      const { includeOptional, ...crawlConfig } = parsed;
      return {
        crawlConfig,
        includeOptional: includeOptional ?? false,
      };
    } catch {
      return { crawlConfig: {}, includeOptional: false };
    }
  }
}