import type { Source } from "../models/source.js";
import type { Job } from "../models/job.js";

export interface ImportResult {
  docCount: number;
  chunkCount: number;
}

export interface Importer {
  readonly type: string;
  import(source: Source): Promise<ImportResult>;
}

import { LlmsTxtImporter } from "./llmstxt.js";
import { LlmsMetaTxtImporter } from "./llmstxt-meta.js";
import { NpmReadmeImporter } from "./npm-readme.js";
import { OpenApiImporter } from "./openapi.js";
import { LlmsTxtCrawlImporter } from "./llmstxt-crawl.js";
import { CrawlerImporter } from "./crawler.js";
import { GithubImporter } from "./github.js";
import { AzureDevopsImporter } from "./azure-devops.js";

const registry: Record<string, Importer> = {
  llmstxt: new LlmsTxtImporter(),
  "llmstxt-meta": new LlmsMetaTxtImporter(),
  "npm-readme": new NpmReadmeImporter(),
  openapi: new OpenApiImporter(),
  "llmstxt-crawl": new LlmsTxtCrawlImporter(),
  crawler: new CrawlerImporter(),
  github: new GithubImporter(),
  azuredevops: new AzureDevopsImporter(),
};

export function getImporter(type: string): Importer | undefined {
  return registry[type];
}
