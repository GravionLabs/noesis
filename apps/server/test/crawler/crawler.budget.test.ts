import { describe, it, expect } from "vitest";
import { normalizeCrawlConfig } from "../../src/crawler/crawler.js";

describe("crawl budget caps", () => {
  it("normalizeCrawlConfig sets maxChunks to undefined by default", () => {
    const config = normalizeCrawlConfig({});
    expect(config.maxChunks).toBeUndefined();
  });

  it("normalizeCrawlConfig sets maxBytes to undefined by default", () => {
    const config = normalizeCrawlConfig({});
    expect(config.maxBytes).toBeUndefined();
  });

  it("normalizeCrawlConfig passes maxChunks through", () => {
    const config = normalizeCrawlConfig({ maxChunks: 50 });
    expect(config.maxChunks).toBe(50);
  });

  it("normalizeCrawlConfig passes maxBytes through", () => {
    const config = normalizeCrawlConfig({ maxBytes: 100_000 });
    expect(config.maxBytes).toBe(100_000);
  });

  it("normalizeCrawlConfig passes maxChunks as 0", () => {
    const config = normalizeCrawlConfig({ maxChunks: 0 });
    expect(config.maxChunks).toBe(0);
  });
});
