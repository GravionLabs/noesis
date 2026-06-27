import { describe, it, expect } from "vitest";
import { parseRobots, isPathAllowedByRobots, normalizeCrawlConfig } from "../../src/crawler/crawler.js";

describe("parseRobots", () => {
  const userAgent = "NoesisBot";

  it("parses Disallow rules for wildcard agent", () => {
    const txt = "User-agent: *\nDisallow: /private/\nDisallow: /admin";
    const rules = parseRobots(txt, userAgent);
    expect(rules.disallow).toEqual(["/private/", "/admin"]);
  });

  it("prefers specific user-agent over wildcard", () => {
    const txt = [
      "User-agent: *",
      "Disallow: /",
      "",
      "User-agent: NoesisBot",
      "Allow: /docs/",
      "Disallow: /private/",
    ].join("\n");
    const rules = parseRobots(txt, userAgent);
    expect(rules.disallow).toEqual(["/private/"]);
    expect(rules.allow).toEqual(["/docs/"]);
  });

  it("ignores rules for unrelated agents", () => {
    const txt = [
      "User-agent: Googlebot",
      "Disallow: /",
      "",
      "User-agent: *",
      "Allow: /",
    ].join("\n");
    const rules = parseRobots(txt, userAgent);
    expect(rules.disallow).toEqual([]);
    expect(rules.allow).toEqual(["/"]);
  });

  it("parses Crawl-delay", () => {
    const txt = "User-agent: *\nCrawl-delay: 10";
    const rules = parseRobots(txt, userAgent);
    expect(rules.crawlDelay).toBe(10);
  });

  it("ignores Crawl-delay with invalid value", () => {
    const txt = "User-agent: *\nCrawl-delay: foo";
    const rules = parseRobots(txt, userAgent);
    expect(rules.crawlDelay).toBeNull();
  });

  it("handles empty robots.txt", () => {
    const rules = parseRobots("", userAgent);
    expect(rules.disallow).toEqual([]);
    expect(rules.allow).toEqual([]);
    expect(rules.crawlDelay).toBeNull();
  });

  it("ignores comment lines", () => {
    const txt = "# This is a comment\nUser-agent: *\n# Another comment\nDisallow: /tmp/";
    const rules = parseRobots(txt, userAgent);
    expect(rules.disallow).toEqual(["/tmp/"]);
  });
});

describe("isPathAllowedByRobots", () => {
  it("allows a path that is not disallowed", () => {
    const rules = { disallow: ["/private/"], allow: [], crawlDelay: null };
    expect(isPathAllowedByRobots("/public/page", rules)).toBe(true);
  });

  it("blocks a disallowed path", () => {
    const rules = { disallow: ["/private/"], allow: [], crawlDelay: null };
    expect(isPathAllowedByRobots("/private/page", rules)).toBe(false);
  });

  it("respects Allow override with longest-match rule", () => {
    const rules = {
      disallow: ["/private/"],
      allow: ["/private/public/"],
      crawlDelay: null,
    };
    // Allow is longer, so it wins
    expect(isPathAllowedByRobots("/private/public/page", rules)).toBe(true);
    // Disallow matches but Allow doesn't → blocked
    expect(isPathAllowedByRobots("/private/other/page", rules)).toBe(false);
  });

  it("blocks root-level disallow", () => {
    const rules = { disallow: ["/"], allow: [], crawlDelay: null };
    expect(isPathAllowedByRobots("/any/page", rules)).toBe(false);
  });

  it("allows everything when no rules", () => {
    const rules = { disallow: [], allow: [], crawlDelay: null };
    expect(isPathAllowedByRobots("/any/page", rules)).toBe(true);
  });
});

describe("normalizeCrawlConfig robots fields", () => {
  it("respectRobots defaults to true", () => {
    const config = normalizeCrawlConfig({});
    expect(config.respectRobots).toBe(true);
  });

  it("obeyCrawlDelay defaults to true", () => {
    const config = normalizeCrawlConfig({});
    expect(config.obeyCrawlDelay).toBe(true);
  });

  it("respectRobots is configurable", () => {
    const config = normalizeCrawlConfig({ respectRobots: false });
    expect(config.respectRobots).toBe(false);
  });

  it("obeyCrawlDelay is configurable", () => {
    const config = normalizeCrawlConfig({ obeyCrawlDelay: false });
    expect(config.obeyCrawlDelay).toBe(false);
  });
});
