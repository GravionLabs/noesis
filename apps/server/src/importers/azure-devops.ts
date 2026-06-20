import { chunkMarkdown } from "./chunk-utils.js";
import type { CrawlChunkData } from "../services/chunk-service.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";
import { AzureDevOpsProvider } from "../crawler/providers/azure-devops-provider.js";
import { db, query, pool } from "../db/pool.js";
import type { Database } from "../db/database.js";

const _defaultDb = {
  db, query, pool,
  getClient: async () => pool.connect(),
  end: async () => { await pool.end(); },
} as unknown as Database;

const _defaultChunkService = new ChunkService({ database: _defaultDb });

export class AzureDevopsImporter implements Importer {
  readonly type = "azuredevops";
  private chunkService: ChunkService;
  private provider: AzureDevOpsProvider;

  constructor({
    chunkService,
    provider,
  }: {
    chunkService: ChunkService;
    provider: AzureDevOpsProvider;
  } = { chunkService: _defaultChunkService, provider: new AzureDevOpsProvider() }) {
    this.chunkService = chunkService;
    this.provider = provider;
  }

  async import(source: Source): Promise<ImportResult> {
    if (!this.provider.canHandle(source.url)) {
      throw new Error("Azure DevOps importer requires a dev.azure.com URL");
    }

    let totalDocs = 0;
    let totalChunks = 0;

    const readme = await this.provider.getReadme(source.url);
    if (readme) {
      const rawChunks = chunkMarkdown(readme.content);
      if (rawChunks.length > 0) {
        const title = this.extractRepoName(source.url) + " README";
        const chunks: CrawlChunkData[] = rawChunks.map((c) => ({
          docUrl: readme.path,
          docTitle: title,
          content: c.content,
          heading: c.heading,
          headingPath: c.headingPath,
          chunkIndex: c.chunkIndex,
          docContentMd: readme.content,
        }));

        const saved = await this.chunkService.saveChunks(chunks, source.id);
        totalDocs += saved.docCount;
        totalChunks += saved.chunkCount;
      }
    }

    const docFiles = await this.provider.getDocFiles(source.url);
    for (const file of docFiles) {
      try {
        const content = await this.provider.getFile(source.url, file.path);
        const rawChunks = chunkMarkdown(content.content);
        if (rawChunks.length === 0) continue;

        const title = this.extractRepoName(source.url) + file.path.replace(/^.*\/docs\//, "/");
        const chunks: CrawlChunkData[] = rawChunks.map((c) => ({
          docUrl: source.url + file.path,
          docTitle: title,
          content: c.content,
          heading: c.heading,
          headingPath: c.headingPath,
          chunkIndex: c.chunkIndex,
          docContentMd: content.content,
        }));

        const saved = await this.chunkService.saveChunks(chunks, source.id);
        totalDocs += saved.docCount;
        totalChunks += saved.chunkCount;
      } catch {
        continue;
      }
    }

    return { docCount: totalDocs, chunkCount: totalChunks };
  }

  private extractRepoName(url: string): string {
    const parts = url.replace(/\/$/, "").split("/");
    return parts[parts.length - 1] || url;
  }
}
