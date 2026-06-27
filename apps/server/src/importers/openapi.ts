import yaml from "js-yaml";
import type { CrawlChunkData } from "../services/chunk-service.js";
import { ChunkService } from "../services/chunk-service.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";
import { fetchOrThrow } from "../utils/fetch.js";

interface OpenApiSpec {
  info?: { title?: string; description?: string };
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
}

function isYamlUrl(url: string): boolean {
  return /\.ya?ml$/i.test(url);
}

async function parseSpec(res: Response, url: string): Promise<OpenApiSpec> {
  if (isYamlUrl(url)) {
    const text = await res.text();
    return yaml.load(text) as OpenApiSpec;
  }
  return res.json() as Promise<OpenApiSpec>;
}

export class OpenApiImporter implements Importer {
  readonly type = "openapi";
  private chunkService: ChunkService;

  constructor({ chunkService }: { chunkService: ChunkService }) {
    this.chunkService = chunkService;
  }

  async import(source: Source): Promise<ImportResult> {
    const res = await fetchOrThrow(source.url);

    const spec = await parseSpec(res, source.url);
    const apiTitle = spec.info?.title ?? source.name;
    const docUrl = source.url;

    const chunks: CrawlChunkData[] = [];

    if (spec.info?.description) {
      chunks.push({
        docUrl,
        docTitle: apiTitle,
        content: spec.info.description,
        heading: "Description",
        headingPath: ["Description"],
        chunkIndex: 0,
      });
    }

    if (!spec.paths) return this.chunkService.saveChunks(chunks, source.id);

    let chunkIndex = chunks.length;
    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(methods)) {
        const content = [
          op.summary,
          op.description,
          `Operation ID: ${op.operationId ?? "N/A"}`,
          `Tags: ${(op.tags ?? []).join(", ") || "N/A"}`,
        ]
          .filter(Boolean)
          .join("\n");

        chunks.push({
          docUrl,
          docTitle: `${method.toUpperCase()} ${path}`,
          content,
          heading: op.summary ?? op.operationId ?? `${method.toUpperCase()} ${path}`,
          headingPath: [
            ...(op.tags ?? []),
            op.summary ?? op.operationId ?? `${method.toUpperCase()} ${path}`,
          ],
          chunkIndex: chunkIndex++,
        });
      }
    }

    return this.chunkService.saveChunks(chunks, source.id);
  }
}
