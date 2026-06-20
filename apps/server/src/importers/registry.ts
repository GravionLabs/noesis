import type { Source } from "../models/source.js";

export interface ImportResult {
  docCount: number;
  chunkCount: number;
}

export interface Importer {
  readonly type: string;
  import(source: Source): Promise<ImportResult>;
}

export class ImporterRegistry {
  private registry: Record<string, Importer>;

  constructor({ importers }: { importers: Importer[] }) {
    this.registry = {};
    for (const imp of importers) {
      this.registry[imp.type] = imp;
    }
  }

  getImporter(type: string): Importer | undefined {
    return this.registry[type];
  }
}

import { LlmsTxtImporter } from "./llmstxt.js";
import { LlmsMetaTxtImporter } from "./llmstxt-meta.js";
import { NpmReadmeImporter } from "./npm-readme.js";
import { OpenApiImporter } from "./openapi.js";
import { LlmsTxtCrawlImporter } from "./llmstxt-crawl.js";
import { CrawlerImporter } from "./crawler.js";
import { GithubImporter } from "./github.js";
import { AzureDevopsImporter } from "./azure-devops.js";
import { ChunkService } from "../services/chunk-service.js";
import { SourceService } from "../services/source-service.js";
import { db, query, pool } from "../db/pool.js";
import type { Database } from "../db/database.js";
import { AzureDevOpsProvider } from "../crawler/providers/azure-devops-provider.js";

const _defaultDb = {
  db, query, pool,
  getClient: async () => pool.connect(),
  end: async () => { await pool.end(); },
} as unknown as Database;

const _defaultChunkService = new ChunkService({ database: _defaultDb });
const _defaultSourceService = new SourceService({ database: _defaultDb });
const _defaultProvider = new AzureDevOpsProvider();

export const getImporter: (type: string) => Importer | undefined = (() => {
  const reg = new ImporterRegistry({
    importers: [
      new LlmsTxtImporter({ chunkService: _defaultChunkService }),
      new LlmsMetaTxtImporter({ sourceService: _defaultSourceService }),
      new NpmReadmeImporter({ chunkService: _defaultChunkService }),
      new OpenApiImporter({ chunkService: _defaultChunkService }),
      new LlmsTxtCrawlImporter({ chunkService: _defaultChunkService }),
      new CrawlerImporter({ chunkService: _defaultChunkService }),
      new GithubImporter({ chunkService: _defaultChunkService }),
      new AzureDevopsImporter({ chunkService: _defaultChunkService, provider: _defaultProvider }),
    ],
  });
  return (type: string) => reg.getImporter(type);
})();
