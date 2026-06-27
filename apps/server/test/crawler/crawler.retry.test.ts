import { describe, it, expect, vi } from "vitest";
import { normalizeCrawlConfig } from "../../src/crawler/crawler.js";

describe("crawlPageWithRetry", () => {
  it("normalizeCrawlConfig sets maxPageRetries default to 2", () => {
    const config = normalizeCrawlConfig({});
    expect(config.maxPageRetries).toBe(2);
  });

  it("normalizeCrawlConfig floors maxPageRetries to 0", () => {
    const config = normalizeCrawlConfig({ maxPageRetries: -1 });
    expect(config.maxPageRetries).toBe(0);
  });

  it("normalizeCrawlConfig passes maxPageRetries through", () => {
    const config = normalizeCrawlConfig({ maxPageRetries: 5 });
    expect(config.maxPageRetries).toBe(5);
  });
});
