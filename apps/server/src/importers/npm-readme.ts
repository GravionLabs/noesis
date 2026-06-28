import { chunkMarkdown } from "./chunk-utils.js";
import type { CrawlChunkData } from "../services/chunk-service.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";

const NPM_REGISTRY = "https://registry.npmjs.org";

interface NpmPackageInfo {
  name: string;
  readme: string;
  description?: string;
}

export class NpmReadmeImporter implements Importer {
  readonly type = "npm-readme";
  private chunkService: ChunkService;

  constructor({ chunkService }: { chunkService: ChunkService }) {
    this.chunkService = chunkService;
  }

  async import(
    source: Source,
    _signal?: AbortSignal,
    onLog?: (message: string, level?: string) => void,
  ): Promise<ImportResult> {
    const match = source.url.match(/npmjs\.com\/package\/(@?[^/]+(?:\/[^/]+)?)/);
    if (!match) throw new Error(`Invalid npm URL: ${source.url}`);

    const packagePath = match[1];
    const res = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(packagePath)}`);
    if (!res.ok) throw new Error(`Failed to fetch npm package: ${res.status}`);

    const info: NpmPackageInfo = await res.json();
    const readme = info.readme;
    if (!readme) return { docCount: 0, chunkCount: 0 };

    const docUrl = source.url;
    const docTitle = `${info.name}${info.description ? `: ${info.description}` : ""}`;

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
