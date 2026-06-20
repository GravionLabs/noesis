import { describe, it, expect } from "vitest";
import { parseLlmsTxt, extractUrls } from "../../src/crawler/llmstxt-parser.js";

describe("parseLlmsTxt", () => {
  it("parses title, description, and links from llms.txt content", () => {
    const content = [
      "# Test Docs",
      "> A comprehensive documentation site.",
      "",
      "- [Getting Started](https://example.com/getting-started)",
      "- [API Reference](https://example.com/api)",
      "",
      "## Optional",
      "- [Advanced Guide](https://example.com/advanced)",
    ].join("\n");

    const result = parseLlmsTxt(content);

    expect(result.title).toBe("Test Docs");
    expect(result.description).toBe("A comprehensive documentation site.");
    expect(result.importantLinks).toHaveLength(2);
    expect(result.importantLinks[0]).toEqual({
      url: "https://example.com/getting-started",
      label: "Getting Started",
      description: "",
    });
    expect(result.importantLinks[1]).toEqual({
      url: "https://example.com/api",
      label: "API Reference",
      description: "",
    });
    expect(result.optionalLinks).toHaveLength(1);
    expect(result.optionalLinks[0]).toEqual({
      url: "https://example.com/advanced",
      label: "Advanced Guide",
      description: "",
    });
  });

  it("handles empty content", () => {
    const result = parseLlmsTxt("");

    expect(result.title).toBe("");
    expect(result.description).toBe("");
    expect(result.importantLinks).toHaveLength(0);
    expect(result.optionalLinks).toHaveLength(0);
  });

  it("handles content with only title", () => {
    const result = parseLlmsTxt("# Just a Title");

    expect(result.title).toBe("Just a Title");
    expect(result.importantLinks).toHaveLength(0);
  });

  it("handles content with only links", () => {
    const content = [
      "- [Link 1](https://example.com/1)",
      "- [Link 2](https://example.com/2)",
    ].join("\n");

    const result = parseLlmsTxt(content);

    expect(result.title).toBe("");
    expect(result.importantLinks).toHaveLength(2);
    expect(result.optionalLinks).toHaveLength(0);
  });
});

describe("extractUrls", () => {
  it("returns important URLs when includeOptional is false", () => {
    const metadata = {
      title: "Test",
      description: "",
      importantLinks: [{ url: "https://example.com/a", label: "A", description: "" }],
      optionalLinks: [{ url: "https://example.com/b", label: "B", description: "" }],
    };

    const urls = extractUrls(metadata, false);

    expect(urls).toEqual(["https://example.com/a"]);
  });

  it("returns all URLs when includeOptional is true", () => {
    const metadata = {
      title: "Test",
      description: "",
      importantLinks: [{ url: "https://example.com/a", label: "A", description: "" }],
      optionalLinks: [{ url: "https://example.com/b", label: "B", description: "" }],
    };

    const urls = extractUrls(metadata, true);

    expect(urls).toEqual(["https://example.com/a", "https://example.com/b"]);
  });

  it("returns empty array when no links exist", () => {
    const metadata = {
      title: "Test",
      description: "",
      importantLinks: [],
      optionalLinks: [],
    };

    const urls = extractUrls(metadata, true);

    expect(urls).toHaveLength(0);
  });
});
