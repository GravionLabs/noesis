import { chunkMarkdown } from "./chunk-utils.js";
import type { CrawlChunkData } from "../services/chunk-service.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";

const GITHUB_RAW = "https://raw.githubusercontent.com";

export class GithubImporter implements Importer {
  readonly type = "github";
  private chunkService: ChunkService;

  constructor({ chunkService }: { chunkService: ChunkService }) {
    this.chunkService = chunkService;
  }

  async import(source: Source): Promise<ImportResult> {
    const match = source.url.match(/github\.com\/([^/]+\/[^/]+)/);
    if (!match) throw new Error(`Invalid GitHub URL: ${source.url}`);

    const repoPath = match[1].replace(/\.git$/, "");
    const readmeUrl = `${GITHUB_RAW}/${repoPath}/main/README.md`;

    const res = await fetch(readmeUrl);
    if (!res.ok) {
      const fallback = await fetch(`${GITHUB_RAW}/${repoPath}/master/README.md`);
      if (!fallback.ok) throw new Error(`Failed to fetch README from ${repoPath}`);
      return this.processReadme(await fallback.text(), source);
    }

    return this.processReadme(await res.text(), source);
  }

  private async processReadme(readme: string, source: Source) {
    const docUrl = `https://github.com/${source.url.match(/github\.com\/([^/]+\/[^/]+)/)![1]}`;
    const docTitle = source.name;

    const { chunks: rawChunks, droppedCount } = chunkMarkdown(readme);
    const chunks: CrawlChunkData[] = rawChunks.map((c) => ({
      docUrl,
      docTitle,
      docContentMd: readme,
      ...c,
    }));

    const saved = await this.chunkService.saveChunks(chunks, source.id);
    return {
      ...saved,
      ...(droppedCount > 0 ? { chunksDropped: [{ reason: "link_list", count: droppedCount }] } : {}),
    };
  }
}
