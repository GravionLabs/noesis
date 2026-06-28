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

  async import(
    source: Source,
    signal?: AbortSignal,
    onLog?: (message: string, level?: string) => void,
  ): Promise<ImportResult> {
    if (signal?.aborted) return { docCount: 0, chunkCount: 0 };

    onLog?.(`Fetching llms.txt from ${source.url}`);
    const res = await fetchOrThrow(source.url);

    const content = await res.text();
    const metadata = parseLlmsTxt(content);
    const parsedConfig = this.parseConfig(source.config);
    const { crawlConfig, includeOptional } = parsedConfig;
    const urls = extractUrls(metadata, includeOptional);

    onLog?.(`Found ${urls.length} URLs in llms.txt`);
    if (urls.length === 0) return { docCount: 0, chunkCount: 0 };

    let totalDocCount = 0;
    let totalChunkCount = 0;
    const chunksDropped: { reason: string; count: number }[] = [];
    let consecutiveFailures = 0;

    const totalBatches = Math.ceil(urls.length / CONCURRENCY);

    for (let i = 0; i < urls.length && !signal?.aborted; i += CONCURRENCY) {
      const batchNum = Math.floor(i / CONCURRENCY) + 1;
      const batch = urls.slice(i, i + CONCURRENCY);

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        onLog?.(`Aborting: ${MAX_CONSECUTIVE_FAILURES} consecutive failures reached`, "error");
        chunksDropped.push({ reason: "too_many_consecutive_failures", count: urls.length - i });
        break;
      }

      onLog?.(`Batch [${batchNum}/${totalBatches}]: crawling ${batch.length} URLs`);
      for (const url of batch) {
        onLog?.(`  Crawling ${url}`);
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
      for (const [idx, result] of results.entries()) {
        const url = batch[idx];
        if (result.status === "fulfilled") {
          const chunkCount = result.value.chunks.length;
          onLog?.(`  \u2713 ${url} (${chunkCount} chunks)`);
          batchChunks.push(...result.value.chunks);
          consecutiveFailures = 0;
        } else {
          batchFailedCount++;
          consecutiveFailures++;
          const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
          onLog?.(`  \u2717 ${url} failed: ${msg}`, "warn");
        }
      }

      if (batchFailedCount === batch.length) {
        onLog?.(`All ${batch.length} URLs in batch failed`, "warn");
        chunksDropped.push({ reason: "crawl_error", count: batch.length });
      }

      if (batchChunks.length > 0) {
        onLog?.(`Saving ${batchChunks.length} chunks from ${batch.length} URLs`);
        const saved = await this.chunkService.saveChunks(batchChunks, source.id);
        totalDocCount += saved.docCount;
        totalChunkCount += saved.chunkCount;
        onLog?.(`Progress: ${totalDocCount} docs, ${totalChunkCount} chunks so far`);
      }
    }

    if (signal?.aborted) {
      onLog?.("Job cancelled during crawl", "warn");
      chunksDropped.push({ reason: "cancelled", count: urls.length });
    }

    onLog?.(`Import complete: ${totalDocCount} docs, ${totalChunkCount} chunks`);
    return {
      docCount: totalDocCount,
      chunkCount: totalChunkCount,
      ...(chunksDropped.length > 0 ? { chunksDropped } : {}),
    };
  }

  private parseConfig(configStr: string | null): { crawlConfig: CrawlConfig; includeOptional: boolean } {
    if (!configStr) return { crawlConfig: { maxDepth: 0 }, includeOptional: false };
    try {
      const parsed = JSON.parse(configStr);
      const { includeOptional, ...crawlConfig } = parsed;
      if (crawlConfig.maxDepth === undefined) {
        crawlConfig.maxDepth = 0;
      }
      return {
        crawlConfig,
        includeOptional: includeOptional ?? false,
      };
    } catch {
      return { crawlConfig: { maxDepth: 0 }, includeOptional: false };
    }
  }
}