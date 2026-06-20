import { chunkMarkdown } from "./chunk-utils.js";
import type { CrawlChunkData } from "../services/chunk-service.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";
import { db, query, pool } from "../db/pool.js";
import type { Database } from "../db/database.js";

const _defaultDb = {
  db, query, pool,
  getClient: async () => pool.connect(),
  end: async () => { await pool.end(); },
} as unknown as Database;

const _defaultChunkService = new ChunkService({ database: _defaultDb });

export class NpmReadmeImporter implements Importer {
  readonly type = "npm-readme";
  private chunkService: ChunkService;

  constructor(
    { chunkService }: { chunkService: ChunkService } = { chunkService: _defaultChunkService },
  ) {
    this.chunkService = chunkService;
  }

  async import(source: Source): Promise<ImportResult> {
    const pkgName = this.extractPackageName(source.url);
    const res = await fetch(`https://registry.npmjs.org/${pkgName}`);
    if (!res.ok) throw new Error(`npm registry returned ${res.status}`);

    const data = (await res.json()) as {
      name?: string;
      description?: string;
      readme?: string;
    };

    const readme = data.readme ?? "";
    if (!readme.trim()) return { docCount: 0, chunkCount: 0 };

    const title = `${data.name ?? pkgName}: ${data.description ?? "README"}`;
    const rawChunks = chunkMarkdown(readme);
    if (rawChunks.length === 0) return { docCount: 0, chunkCount: 0 };

    const chunks: CrawlChunkData[] = rawChunks.map((c) => ({
      docUrl: source.url,
      docTitle: title,
      content: c.content,
      heading: c.heading,
      headingPath: c.headingPath,
      chunkIndex: c.chunkIndex,
      docContentMd: readme,
    }));

    return this.chunkService.saveChunks(chunks, source.id);
  }

  private extractPackageName(url: string): string {
    const u = new URL(url);
    const parts = u.pathname.replace(/\/$/, "").split("/");
    return parts[parts.length - 1] || parts[parts.length - 2] || "lodash";
  }
}
