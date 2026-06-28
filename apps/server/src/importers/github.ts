import { chunkMarkdown } from "./chunk-utils.js";
import type { CrawlChunkData } from "../services/chunk-service.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";
import { GithubProvider } from "../crawler/providers/github-provider.js";

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/#?]+?)(?:\/|\.git|$)/);
  if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  return null;
}

export class GithubImporter implements Importer {
  readonly type = "github";
  private chunkService: ChunkService;
  private provider: GithubProvider;

  constructor({
    chunkService,
    provider,
  }: {
    chunkService: ChunkService;
    provider: GithubProvider;
  }) {
    this.chunkService = chunkService;
    this.provider = provider;
  }

  async import(source: Source, _signal?: AbortSignal): Promise<ImportResult> {
    if (!this.provider.canHandle(source.url)) {
      throw new Error("Invalid GitHub URL");
    }

    let totalDocs = 0;
    let totalChunks = 0;
    let totalDropped = 0;

    const readme = await this.provider.getReadme(source.url);
    if (readme) {
      const { chunks: rawChunks, droppedCount } = chunkMarkdown(readme.content);
      totalDropped += droppedCount;
      if (rawChunks.length > 0) {
        const repoName = this.extractRepoName(source.url) + " README";
        const chunks: CrawlChunkData[] = rawChunks.map((c) => ({
          docUrl: source.url,
          docTitle: repoName,
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
        const { chunks: rawChunks, droppedCount } = chunkMarkdown(content.content);
        totalDropped += droppedCount;
        if (rawChunks.length === 0) continue;

        const title = this.extractRepoName(source.url) + file.path.replace(/^.*\/docs\//, "/");
        const parsed = parseGitHubUrl(source.url);
        const docUrl = parsed
          ? `https://github.com/${parsed.owner}/${parsed.repo}/blob/main/${file.path}`
          : source.url + "/" + file.path;
        const chunks: CrawlChunkData[] = rawChunks.map((c) => ({
          docUrl,
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

    return {
      docCount: totalDocs,
      chunkCount: totalChunks,
      ...(totalDropped > 0 ? { chunksDropped: [{ reason: "link_list", count: totalDropped }] } : {}),
    };
  }

  private extractRepoName(url: string): string {
    const parsed = parseGitHubUrl(url);
    return parsed ? parsed.repo : url;
  }
}
