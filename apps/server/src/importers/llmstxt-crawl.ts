import { crawlUrl } from "../crawler/crawler.js";
import type { CrawlConfig } from "../crawler/crawler.js";
import { parseLlmsTxt, extractUrls } from "../crawler/llmstxt-parser.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";
import { fetchOrThrow } from "../utils/fetch.js";

const CONCURRENCY = 3;

export class LlmsTxtCrawlImporter implements Importer {
  readonly type = "llmstxt-crawl";
  private chunkService: ChunkService;

  constructor({ chunkService }: { chunkService: ChunkService }) {
    this.chunkService = chunkService;
  }

  async import(source: Source): Promise<ImportResult> {
    const res = await fetchOrThrow(source.url);

    const content = await res.text();
    const metadata = parseLlmsTxt(content);
    const parsedConfig = this.parseConfig(source.config);
    const { crawlConfig, includeOptional } = parsedConfig;
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

    let failedUrlCount = 0;

    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      const batch = urls.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((u) => crawlUrl(u, crawlConfig)),
      );
      for (const result of results) {
        if (result.status === "fulfilled") {
          allChunks.push(...result.value.chunks);
        } else {
          failedUrlCount++;
          console.warn(`llmstxt-crawl: URL crawl failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
        }
      }
    }

    if (allChunks.length === 0) return { docCount: 0, chunkCount: 0 };

    const saved = await this.chunkService.saveChunks(allChunks, source.id);

    if (failedUrlCount > 0) {
      return {
        docCount: saved.docCount,
        chunkCount: saved.chunkCount,
        chunksDropped: [{ reason: "crawl_error", count: failedUrlCount }],
      };
    }

    return saved as ImportResult;
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
