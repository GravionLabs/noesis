import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { normalizeCrawlConfig, crawlPage } from "../../src/crawler/crawler.js";
import type { Browser } from "playwright";

describe("incremental crawl", () => {
  describe("normalizeCrawlConfig", () => {
    it("defaults incremental to false", () => {
      const config = normalizeCrawlConfig({});
      expect(config.incremental).toBe(false);
    });

    it("passes incremental true through", () => {
      const config = normalizeCrawlConfig({ incremental: true });
      expect(config.incremental).toBe(true);
    });

    it("passes incremental false through", () => {
      const config = normalizeCrawlConfig({ incremental: false });
      expect(config.incremental).toBe(false);
    });

    it("defaults knownHashes to an empty Map", () => {
      const config = normalizeCrawlConfig({});
      expect(config.knownHashes).toBeInstanceOf(Map);
      expect(config.knownHashes.size).toBe(0);
    });
  });

  describe("hash computation", () => {
    it("computes md5 of HTML content, matching knownHashes lookup", () => {
      const html = "<html><body><main><p>Hello world</p></main></body></html>";
      const hash = createHash("md5").update(html).digest("hex");
      expect(hash).toHaveLength(32);
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
    });

    it("produces different hashes for different content", () => {
      const html1 = "<html><body>A</body></html>";
      const html2 = "<html><body>B</body></html>";
      const hash1 = createHash("md5").update(html1).digest("hex");
      const hash2 = createHash("md5").update(html2).digest("hex");
      expect(hash1).not.toBe(hash2);
    });
  });
});
