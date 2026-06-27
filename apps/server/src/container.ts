import { createContainer, asClass, asValue, asFunction } from "awilix";
import { config } from "./config/index.js";
import { logger } from "./logger.js";
import { Database } from "./db/database.js";
import { PostgresLock } from "./db/lock.js";
import { SourceService } from "./services/source-service.js";
import { JobService } from "./services/job-service.js";
import { ChunkService } from "./services/chunk-service.js";
import { EmbeddingService } from "./services/embedding-service.js";
import { SearchService } from "./services/search-service.js";
import { StatsService } from "./services/stats-service.js";
import { ImportService } from "./services/import-service.js";
import { JobRunner } from "./pipeline/job-runner.js";
import { Scheduler } from "./pipeline/scheduler.js";
import { McpHandler } from "./mcp/handler.js";
import { ImporterRegistry } from "./importers/registry.js";
import { LlmsTxtImporter } from "./importers/llmstxt.js";
import { LlmsMetaTxtImporter } from "./importers/llmstxt-meta.js";
import { NpmReadmeImporter } from "./importers/npm-readme.js";
import { OpenApiImporter } from "./importers/openapi.js";
import { LlmsTxtCrawlImporter } from "./importers/llmstxt-crawl.js";
import { CrawlerImporter } from "./importers/crawler.js";
import { GithubImporter } from "./importers/github.js";
import { AzureDevopsImporter } from "./importers/azure-devops.js";
import { UrlListImporter } from "./importers/url-list.js";
import { LocalFilesystemImporter } from "./importers/local-filesystem.js";
import { AzureDevOpsProvider } from "./crawler/providers/azure-devops-provider.js";
import { GithubProvider } from "./crawler/providers/github-provider.js";

export function buildContainer() {
  const container = createContainer({ injectionMode: "PROXY" });

  container.register({
    config: asValue(config),
    logger: asValue(logger),
  });

  container.register({
    database: asClass(Database).singleton(),
    lock: asClass(PostgresLock).singleton(),
  });

  container.register({
    sourceService: asClass(SourceService).singleton(),
    jobService: asClass(JobService).singleton(),
    chunkService: asClass(ChunkService).singleton(),
    embeddingService: asClass(EmbeddingService).singleton(),
  });

  container.register({
    searchService: asClass(SearchService).singleton(),
    statsService: asClass(StatsService).singleton(),
  });

  container.register({
    azureDevOpsProvider: asClass(AzureDevOpsProvider).singleton(),
    githubProvider: asClass(GithubProvider).singleton(),
  });

  container.register({
    llmstxtImporter: asClass(LlmsTxtImporter).singleton(),
    llmsMetaTxtImporter: asClass(LlmsMetaTxtImporter).singleton(),
    npmReadmeImporter: asClass(NpmReadmeImporter).singleton(),
    openApiImporter: asClass(OpenApiImporter).singleton(),
    llmstxtCrawlImporter: asClass(LlmsTxtCrawlImporter).singleton(),
    crawlerImporter: asClass(CrawlerImporter).singleton(),
    githubImporter: asClass(GithubImporter)
      .inject(() => ({
        provider: (container.cradle as any).githubProvider,
      }))
      .singleton(),
    urlListImporter: asClass(UrlListImporter).singleton(),
    localFilesystemImporter: asClass(LocalFilesystemImporter).singleton(),
    azureDevopsImporter: asClass(AzureDevopsImporter)
      .inject(() => ({
        provider: (container.cradle as any).azureDevOpsProvider,
      }))
      .singleton(),
  });

  container.register({
    importerRegistry: asFunction((c: any) => new ImporterRegistry({
      importers: [
        c.llmstxtImporter,
        c.llmsMetaTxtImporter,
        c.npmReadmeImporter,
        c.openApiImporter,
        c.llmstxtCrawlImporter,
        c.crawlerImporter,
        c.githubImporter,
        c.urlListImporter,
        c.localFilesystemImporter,
        c.azureDevopsImporter,
      ],
    })).singleton(),
  });

  container.register({
    jobRunner: asClass(JobRunner).singleton(),
  });

  container.register({
    importService: asClass(ImportService).singleton(),
  });

  container.register({
    scheduler: asClass(Scheduler).singleton(),
  });

  container.register({
    mcpHandler: asClass(McpHandler).singleton(),
  });

  return container;
}
