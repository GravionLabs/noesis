import { promises as fs } from "fs";
import path from "path";
import { chunkMarkdown } from "./chunk-utils.js";
import type { CrawlChunkData } from "../services/chunk-service.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";

function parseFileUrl(url: string): string {
  if (url.startsWith("file://")) return url.slice(7);
  return url;
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "__pycache__", ".next", ".cache"]);

export class LocalFilesystemImporter implements Importer {
  readonly type = "local";
  private chunkService: ChunkService;

  constructor({ chunkService }: { chunkService: ChunkService }) {
    this.chunkService = chunkService;
  }

  async import(source: Source): Promise<ImportResult> {
    const basePath = path.resolve(parseFileUrl(source.url));

    let totalDocs = 0;
    let totalChunks = 0;
    let totalDropped = 0;

    const mdFiles = await this.findMdFiles(basePath);

    for (const filePath of mdFiles) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const relativePath = path.relative(basePath, filePath);
        const { chunks: rawChunks, droppedCount } = chunkMarkdown(content);
        totalDropped += droppedCount;
        if (rawChunks.length === 0) continue;

        const chunks: CrawlChunkData[] = rawChunks.map((c) => ({
          docUrl: `file://${filePath}`,
          docTitle: relativePath,
          content: c.content,
          heading: c.heading,
          headingPath: c.headingPath,
          chunkIndex: c.chunkIndex,
          docContentMd: content,
        }));

        const saved = await this.chunkService.saveChunks(chunks, source.id);
        totalDocs += saved.docCount;
        totalChunks += saved.chunkCount;
      } catch {
        totalDropped++;
      }
    }

    return {
      docCount: totalDocs,
      chunkCount: totalChunks,
      ...(totalDropped > 0 ? { chunksDropped: [{ reason: "read_error", count: totalDropped }] } : {}),
    };
  }

  private async findMdFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const sub = await this.findMdFiles(fullPath);
          files.push(...sub);
        } else if (entry.name.endsWith(".md")) {
          files.push(fullPath);
        }
      }
    } catch {
      // skip unreadable directories
    }

    return files;
  }
}
