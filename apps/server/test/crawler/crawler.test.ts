import { describe, it, expect } from "vitest";
import { extractLocsFromSitemap, normalizeCrawlConfig, normalizeUrl } from "../../src/crawler/crawler.js";

describe("normalizeUrl", () => {
  it("removes hashes and trailing index files", () => {
    expect(normalizeUrl("https://example.com/docs/#intro")).toBe("https://example.com/docs");
    expect(normalizeUrl("https://example.com/docs/index.html")).toBe("https://example.com/docs");
    expect(normalizeUrl("https://example.com/docs/index.htm")).toBe("https://example.com/docs");
    expect(normalizeUrl("https://example.com/docs/")).toBe("https://example.com/docs");
  });
});

describe("normalizeCrawlConfig", () => {
  it("applies defaults and custom overrides", () => {
    const config = normalizeCrawlConfig({
      maxDepth: 4,
      crawlDelayMs: 250,
      allowedHosts: ["example.com"],
    });

    expect(config.maxDepth).toBe(4);
    expect(config.crawlDelayMs).toBe(250);
    expect(config.allowedHosts).toEqual(["example.com"]);
    expect(config.includeSitemap).toBe(true);
  });
});

describe("extractLocsFromSitemap", () => {
  it("resolves relative URLs", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset>
        <url><loc>/docs/getting-started</loc></url>
        <url><loc>https://example.com/docs/advanced/</loc></url>
      </urlset>`;

    const urls = extractLocsFromSitemap(xml, "https://example.com/sitemap.xml");

    expect(urls).toEqual([
      "https://example.com/docs/getting-started",
      "https://example.com/docs/advanced",
    ]);
  });
});
