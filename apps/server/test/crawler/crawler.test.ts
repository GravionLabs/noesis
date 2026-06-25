import { describe, it, expect } from "vitest";
import {
  extractLocsFromSitemap,
  normalizeCrawlConfig,
  normalizeUrl,
  normalizeContentHash,
  extractChunks,
  stripCrawlerNoise,
} from "../../src/crawler/crawler.js";
import { chunkMarkdown } from "../../src/importers/chunk-utils.js";

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

// ---------------------------------------------------------------------------
// #258: normalizeContentHash
// ---------------------------------------------------------------------------
describe("normalizeContentHash", () => {
  it("lowercases the text", () => {
    expect(normalizeContentHash("Hello World")).toBe("hello world");
  });

  it("collapses multiple whitespace characters to a single space", () => {
    expect(normalizeContentHash("foo   bar\tbaz\n  qux")).toBe("foo bar baz qux");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeContentHash("  hello  ")).toBe("hello");
  });

  it("produces identical hashes for content that only differs in case and spacing", () => {
    const a = "  On This Page\n  Introduction\n  Getting Started  ";
    const b = "on this page introduction getting started";
    expect(normalizeContentHash(a)).toBe(normalizeContentHash(b));
  });
});

// ---------------------------------------------------------------------------
// #258: extractChunks — DOM cleanup and cross-page dedup
// ---------------------------------------------------------------------------
describe("extractChunks", () => {
  const pageUrl = "https://example.com/docs/guide";

  it("removes aside/sidebar/toc elements before chunking", () => {
    const html = `
      <html><body>
        <aside class="sidebar">
          <nav>Table of contents: <a href="#intro">Intro</a></nav>
        </aside>
        <div class="toc" id="toc">
          <ul><li><a href="#intro">Introduction</a></li></ul>
        </div>
        <main>
          <h2>Introduction</h2>
          <p>Angular is a platform and framework for building single-page client applications
          using HTML and TypeScript. It implements core and optional functionality as a set
          of TypeScript libraries that you import into your applications.</p>
        </main>
      </body></html>`;

    const { chunks } = extractChunks(html, pageUrl);

    // Real content is present
    expect(chunks.some((c) => c.content.includes("Angular is a platform"))).toBe(true);

    // Sidebar/TOC text is not present in any chunk
    const allContent = chunks.map((c) => c.content).join(" ");
    expect(allContent).not.toContain("Table of contents");
  });

  it("removes aria-hidden elements", () => {
    const html = `
      <html><body>
        <div aria-hidden="true">Decorative content that should be stripped out completely.</div>
        <main>
          <h2>Real content</h2>
          <p>This is the genuine article content that should be included in the search index
          and returned to users when they query the documentation system for relevant topics.</p>
        </main>
      </body></html>`;

    const { chunks } = extractChunks(html, pageUrl);
    const allContent = chunks.map((c) => c.content).join(" ");
    expect(allContent).not.toContain("Decorative content");
    expect(allContent).toContain("genuine article content");
  });

  it("removes elements with cookie-related class names", () => {
    const html = `
      <html><body>
        <div class="cookie-banner">We use cookies to improve your experience. Accept all cookies.</div>
        <main>
          <h2>Getting started</h2>
          <p>Install the Angular CLI to begin building Angular applications with best practices,
          run tests, generate components and more from a powerful command-line interface tool.</p>
        </main>
      </body></html>`;

    const { chunks } = extractChunks(html, pageUrl);
    const allContent = chunks.map((c) => c.content).join(" ");
    expect(allContent).not.toContain("We use cookies");
    expect(allContent).toContain("Install the Angular CLI");
  });

  it("deduplicates identical boilerplate appearing on a second call with the same seenHashes Set", () => {
    const boilerplateHtml = `
      <html><body><main>
        <h2>On this page</h2>
        <p>This is a sidebar navigation element that appears on every single page of the documentation
        site and repeats the same content verbatim without any page-specific variation whatsoever.</p>
      </main></body></html>`;

    const seenHashes = new Set<string>();

    // First occurrence — kept
    const { chunks: firstPage } = extractChunks(boilerplateHtml, "https://example.com/page-1", seenHashes);
    expect(firstPage.length).toBeGreaterThan(0);

    // Second occurrence — deduplicated (same hash already in seenHashes)
    const { chunks: secondPage } = extractChunks(boilerplateHtml, "https://example.com/page-2", seenHashes);
    expect(secondPage.length).toBe(0);
  });

  it("keeps distinct content on different pages when seenHashes is shared", () => {
    const page1Html = `
      <html><body><main>
        <h2>Introduction</h2>
        <p>Angular is a platform and framework for building single-page client applications
        using HTML and TypeScript that is maintained by the Google Angular team worldwide.</p>
      </main></body></html>`;

    const page2Html = `
      <html><body><main>
        <h2>Components</h2>
        <p>Components are the main building blocks for Angular applications and each component
        consists of a TypeScript class with a decorator, a template and optional CSS styles.</p>
      </main></body></html>`;

    const seenHashes = new Set<string>();
    const { chunks: chunks1 } = extractChunks(page1Html, "https://example.com/intro", seenHashes);
    const { chunks: chunks2 } = extractChunks(page2Html, "https://example.com/components", seenHashes);

    expect(chunks1.some((c) => c.content.includes("Angular is a platform"))).toBe(true);
    expect(chunks2.some((c) => c.content.includes("Components are the main building blocks"))).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // #260: regression — all-noise page (pure link list) produces 0 chunks
  // ---------------------------------------------------------------------------
  it("produces 0 chunks for an all-link-list page (regression for #260 docCount)", () => {
    const allNoiseHtml = `
      <html><body><main>
        <h2>See also</h2>
        <ul>
          <li><a href="/guide/zoneless">Zoneless change detection</a></li>
          <li><a href="/guide/signals">Linked Signal API</a></li>
          <li><a href="/guide/hydration">Incremental hydration</a></li>
          <li><a href="/guide/resource">Resource API</a></li>
          <li><a href="/guide/testing">Component testing</a></li>
        </ul>
      </main></body></html>`;

    // Note: turndown converts <ul><li><a> to "- [Text](url)" which triggers
    // the link-list filter in chunkMarkdown.
    const { chunks } = extractChunks(allNoiseHtml, "https://example.com/see-also");
    expect(chunks.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// #259: stripCrawlerNoise
// ---------------------------------------------------------------------------
describe("stripCrawlerNoise", () => {
  it("strips a 'Next: [Title](url)' pagination line", () => {
    const markdown = [
      "## Summary",
      "",
      "This section introduces the core concepts of Angular dependency injection system.",
      "",
      "Next: [Services and DI](/guide/services)",
    ].join("\n");

    const result = stripCrawlerNoise(markdown);
    expect(result).not.toContain("Next:");
    expect(result).toContain("core concepts of Angular");
  });

  it("strips a 'Previous: [Title](url)' pagination line", () => {
    const markdown = "Previous: [Introduction](/guide/intro)\n\nSome real content here that should be preserved.";
    const result = stripCrawlerNoise(markdown);
    expect(result).not.toContain("Previous:");
    expect(result).toContain("Some real content");
  });

  it("strips a 'Prev: [Title](url)' pagination line (abbreviated form)", () => {
    const markdown = "Prev: [Components](/guide/components)\n\nMore real documentation content goes here.";
    const result = stripCrawlerNoise(markdown);
    expect(result).not.toContain("Prev:");
    expect(result).toContain("More real documentation content");
  });

  it("strips a breadcrumb chain line using › separator", () => {
    const markdown = [
      "[Home](/) › [Docs](/docs) › [Guide](/guide)",
      "",
      "This is the actual content of the page that users are looking for.",
    ].join("\n");

    const result = stripCrawlerNoise(markdown);
    expect(result).not.toContain("[Home](/)");
    expect(result).toContain("actual content of the page");
  });

  it("strips a breadcrumb chain line using / separator", () => {
    const markdown = [
      "[Home](/) / [Docs](/docs) / [Reference](/ref)",
      "",
      "Real content that should be preserved in the output chunks.",
    ].join("\n");

    const result = stripCrawlerNoise(markdown);
    expect(result).not.toContain("[Home](/)");
    expect(result).toContain("Real content that should be preserved");
  });

  it("does NOT strip pagination-like text inside a fenced code block", () => {
    const markdown = [
      "```",
      "Next: [Page Two](/two)",
      "[Home](/) › [Docs](/docs)",
      "```",
      "",
      "Normal prose content that comes after the code block example shown above.",
    ].join("\n");

    const result = stripCrawlerNoise(markdown);
    expect(result).toContain("Next: [Page Two](/two)");
    expect(result).toContain("[Home](/) › [Docs](/docs)");
    expect(result).toContain("Normal prose content");
  });

  it("does NOT affect regular prose lines", () => {
    const markdown = [
      "Angular provides a comprehensive framework for building applications.",
      "It supports server-side rendering, lazy loading, and much more.",
    ].join("\n");

    const result = stripCrawlerNoise(markdown);
    expect(result).toBe(markdown);
  });

  it("does NOT affect non-crawler importers (chunkMarkdown is unaffected)", () => {
    // Verify that chunkMarkdown itself does NOT strip these patterns,
    // so llmstxt/npm/github importers are never affected.
    const llmstxtContent = [
      "## Navigation",
      "",
      "Next: [Advanced Guide](/guide/advanced)",
      "[Home](/) › [Docs](/docs) › [Guide](/guide)",
      "",
      "This section covers advanced Angular dependency injection patterns and practices.",
      "Understanding these patterns will help you write more modular and testable applications.",
    ].join("\n");

    const { chunks } = chunkMarkdown(llmstxtContent);

    // chunkMarkdown keeps these lines (they are not link-list-only; the chunk
    // also has prose, so the link-list ratio is below 0.7)
    const allContent = chunks.map((c) => c.content).join("\n");
    expect(allContent).toContain("Next: [Advanced Guide]");
    expect(allContent).toContain("[Home](/) › [Docs]");
  });
});
