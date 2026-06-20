import { describe, it, expect } from "vitest";
import { buildContainer } from "../src/container.js";

describe("buildContainer", () => {
  it("resolves all registrations without throwing", () => {
    const container = buildContainer();
    const cradle = container.cradle;

    expect(cradle.config).toBeDefined();
    expect(cradle.logger).toBeDefined();
    expect(cradle.database).toBeDefined();
    expect(cradle.sourceService).toBeDefined();
    expect(cradle.jobService).toBeDefined();
    expect(cradle.chunkService).toBeDefined();
    expect(cradle.embeddingService).toBeDefined();
    expect(cradle.searchService).toBeDefined();
    expect(cradle.statsService).toBeDefined();
    expect(cradle.importService).toBeDefined();
    expect(cradle.jobRunner).toBeDefined();
    expect(cradle.scheduler).toBeDefined();
    expect(cradle.mcpHandler).toBeDefined();
    expect(cradle.importerRegistry).toBeDefined();
    expect(cradle.llmstxtImporter).toBeDefined();
    expect(cradle.llmsMetaTxtImporter).toBeDefined();
    expect(cradle.npmReadmeImporter).toBeDefined();
    expect(cradle.openApiImporter).toBeDefined();
    expect(cradle.llmstxtCrawlImporter).toBeDefined();
    expect(cradle.crawlerImporter).toBeDefined();
    expect(cradle.githubImporter).toBeDefined();
    expect(cradle.azureDevopsImporter).toBeDefined();
    expect(cradle.azureDevOpsProvider).toBeDefined();
  });

  it("resolves same instance for singleton scoped registrations", () => {
    const container = buildContainer();
    expect(container.cradle.sourceService).toBe(container.cradle.sourceService);
    expect(container.cradle.jobService).toBe(container.cradle.jobService);
    expect(container.cradle.chunkService).toBe(container.cradle.chunkService);
    expect(container.cradle.embeddingService).toBe(container.cradle.embeddingService);
    expect(container.cradle.searchService).toBe(container.cradle.searchService);
    expect(container.cradle.statsService).toBe(container.cradle.statsService);
    expect(container.cradle.importService).toBe(container.cradle.importService);
    expect(container.cradle.jobRunner).toBe(container.cradle.jobRunner);
    expect(container.cradle.scheduler).toBe(container.cradle.scheduler);
    expect(container.cradle.mcpHandler).toBe(container.cradle.mcpHandler);
    expect(container.cradle.importerRegistry).toBe(container.cradle.importerRegistry);
  });

  it("passes correct dependencies between services", () => {
    const container = buildContainer();
    const cradle = container.cradle;

    expect(cradle.jobRunner).toBe(cradle.importService["jobRunner"]);
    expect(cradle.sourceService).toBe(cradle.statsService["sourceService"]);
    expect(cradle.jobService).toBe(cradle.statsService["jobService"]);
    expect(cradle.embeddingService).toBe(cradle.searchService["embeddingService"]);
  });
});
