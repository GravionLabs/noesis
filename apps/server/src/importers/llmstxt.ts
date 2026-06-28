import { chunkMarkdown } from "./chunk-utils.js";
import type { CrawlChunkData } from "../services/chunk-service.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";
import { fetchOrThrow } from "../utils/fetch.js";

export class LlmsTxtImporter implements Importer {
  readonly type = "llmstxt";
  private chunkService: ChunkService;

  constructor({ chunkService }: { chunkService: ChunkService }) {
    this.chunkService = chunkService;
  }

  async import(source: Source, _signal?: AbortSignal): Promise<ImportResult> {
    const res = await fetchOrThrow(source.url);

    const text = await res.text();
    const { chunks: rawChunks, droppedCount } = chunkMarkdown(text);

    const title = text.match(/^#\s+(.+)/m)?.[1]?.trim() ?? source.name;
    const chunks: CrawlChunkData[] = rawChunks.map((c) => ({
      docUrl: source.url,
      docTitle: title,
      docContentMd: text,
      ...c,
    }));

    const saved = await this.chunkService.saveChunks(chunks, source.id);
    return {
      ...saved,
      ...(droppedCount > 0 ? { chunksDropped: [{ reason: "link_list", count: droppedCount }] } : {}),
    };
  }
}
