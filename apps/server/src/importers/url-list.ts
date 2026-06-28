import { chunkMarkdown } from "./chunk-utils.js";
import type { CrawlChunkData } from "../services/chunk-service.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";
import { fetchOrThrow } from "../utils/fetch.js";

const BATCH_SIZE = 5;

export class UrlListImporter implements Importer {
  readonly type = "url-list";
  private chunkService: ChunkService;

  constructor({ chunkService }: { chunkService: ChunkService }) {
    this.chunkService = chunkService;
  }

  async import(
    source: Source,
    _signal?: AbortSignal,
    onLog?: (message: string, level?: string) => void,
  ): Promise<ImportResult> {
    const res = await fetchOrThrow(source.url);
    const text = await res.text();

    const urls = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    if (urls.length === 0) return { docCount: 0, chunkCount: 0 };

    let totalDocs = 0;
    let totalChunks = 0;
    let totalDropped = 0;

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (url) => {
          const pageRes = await fetchOrThrow(url);
          const content = await pageRes.text();
          const { chunks: rawChunks, droppedCount } = chunkMarkdown(content);
          return { url, content, rawChunks, droppedCount };
        }),
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          const { url, content, rawChunks, droppedCount } = result.value;
          totalDropped += droppedCount;
          if (rawChunks.length === 0) continue;

          const chunks: CrawlChunkData[] = rawChunks.map((c) => ({
            docUrl: url,
            docTitle: url,
            content: c.content,
            heading: c.heading,
            headingPath: c.headingPath,
            chunkIndex: c.chunkIndex,
            docContentMd: content,
          }));

          const saved = await this.chunkService.saveChunks(chunks, source.id);
          totalDocs += saved.docCount;
          totalChunks += saved.chunkCount;
        } else {
          totalDropped++;
        }
      }
    }

    return {
      docCount: totalDocs,
      chunkCount: totalChunks,
      ...(totalDropped > 0 ? { chunksDropped: [{ reason: "fetch_error", count: totalDropped }] } : {}),
    };
  }
}
