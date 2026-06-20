import { chunkMarkdown } from "./chunk-utils.js";
import type { CrawlChunkData } from "../services/chunk-service.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";

export class LlmsTxtImporter implements Importer {
  readonly type = "llmstxt";
  private chunkService: ChunkService;

  constructor({ chunkService }: { chunkService: ChunkService }) {
    this.chunkService = chunkService;
  }

  async import(source: Source): Promise<ImportResult> {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`Failed to fetch ${source.url}: ${res.status}`);

    const text = await res.text();
    const rawChunks = chunkMarkdown(text);

    const title = text.match(/^#\s+(.+)/m)?.[1]?.trim() ?? source.name;
    const chunks: CrawlChunkData[] = rawChunks.map((c) => ({
      docUrl: source.url,
      docTitle: title,
      docContentMd: text,
      ...c,
    }));

    return this.chunkService.saveChunks(chunks, source.id);
  }
}
