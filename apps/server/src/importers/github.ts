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

export class GithubImporter implements Importer {
  readonly type = "github";
  private chunkService: ChunkService;

  constructor(
    { chunkService }: { chunkService: ChunkService } = { chunkService: _defaultChunkService },
  ) {
    this.chunkService = chunkService;
  }

  async import(source: Source): Promise<ImportResult> {
    const match = source.url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Invalid GitHub URL");

    const [, owner, repo] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;

    const res = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.raw" },
    });
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);

    const md = await res.text();
    const rawChunks = chunkMarkdown(md);
    if (rawChunks.length === 0) return { docCount: 0, chunkCount: 0 };

    const title = `${owner}/${repo} README`;

    const chunks: CrawlChunkData[] = rawChunks.map((c) => ({
      docUrl: source.url,
      docTitle: title,
      content: c.content,
      heading: c.heading,
      headingPath: c.headingPath,
      chunkIndex: c.chunkIndex,
      docContentMd: md,
    }));

    return this.chunkService.saveChunks(chunks, source.id);
  }
}
