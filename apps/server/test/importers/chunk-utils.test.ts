import { describe, it, expect } from "vitest";
import { chunkMarkdown, isLinkListChunk, MIN_CHUNK_CHARS, LINK_LIST_RATIO } from "../../src/importers/chunk-utils.js";

function block(text: string, n = 3): string {
  return (text + "\n").repeat(n);
}

describe("chunkMarkdown", () => {
  it("chunks long text without headings", () => {
    const text = block("This is a paragraph with enough content to exceed the 50-character minimum threshold for chunk creation.", 100);
    const { chunks } = chunkMarkdown(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("splits on headings", () => {
    const text = [
      "# Title",
      "",
      block("Some introductory content that is definitely longer than 50 characters to ensure it gets picked up.", 5),
      "",
      "## Section 1",
      "",
      block("Content under section one that also exceeds the 50 character minimum threshold for chunk creation.", 5),
      "",
      "## Section 2",
      "",
      block("More content that goes well beyond the minimum length so it forms a valid chunk.", 5),
    ].join("\n");

    const { chunks } = chunkMarkdown(text);
    expect(chunks.length).toBe(3);
    expect(chunks[0].heading).toBe("Title");
    expect(chunks[1].heading).toBe("Section 1");
    expect(chunks[2].heading).toBe("Section 2");
  });

  it("tracks heading path", () => {
    const text = [
      "# H1",
      "",
      block("Some content under H1 that is long enough to meet the minimum threshold of 50 characters.", 3),
      "",
      "## H2",
      "",
      block("Content under H2 that needs to be long enough to meet the minimum of 50 characters.", 3),
      "",
      "### H3",
      "",
      block("Content under H3 that exceeds the minimum threshold of 50 characters quite easily.", 3),
      "",
      "## H2b",
      "",
      block("More content that will be part of a different section in the heading path hierarchy.", 3),
    ].join("\n");

    const { chunks } = chunkMarkdown(text);
    expect(chunks[0].headingPath).toEqual(["H1"]);
    expect(chunks[1].headingPath).toEqual(["H1", "H2"]);
    expect(chunks[2].headingPath).toEqual(["H1", "H2", "H3"]);
    expect(chunks[3].headingPath).toEqual(["H1", "H2b"]);
  });

  it("discards chunks with <= 50 chars", () => {
    const text = "# H1\n\nshort";
    const { chunks } = chunkMarkdown(text);
    expect(chunks.length).toBe(0);
  });

  it("returns empty array for empty input", () => {
    const { chunks } = chunkMarkdown("");
    expect(chunks).toEqual([]);
  });

  it("strips standalone HTML tag lines but keeps their text content", () => {
    const text = [
      "# Title",
      "",
      '<div style="margin: 2em">',
      block("Maintained by a dedicated team at Google, this paragraph is long enough to count.", 1),
      "</div>",
      "",
      '<docs-nav-card title="Want to see some code?" iconImgSrc="adev/src/assets/icons/star.svg">',
      '  <docs-nav-link title="Essentials" iconName="docs" href="essentials" iconImgSrc="adev/src/assets/icons/docs.svg">',
      "    An overview of what it's like to use Angular and why it might be a good fit for your project.",
      "  </docs-nav-link>",
      "</docs-nav-card>",
    ].join("\n");

    const { chunks } = chunkMarkdown(text);
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).not.toContain("<div");
    expect(chunks[0].content).not.toContain("<docs-nav-card");
    expect(chunks[0].content).not.toContain("<docs-nav-link");
    expect(chunks[0].content).toContain("Maintained by a dedicated team at Google");
    expect(chunks[0].content).toContain("An overview of what it's like to use Angular");
  });

  it("does not strip tag-like syntax inside fenced code blocks", () => {
    const text = [
      "# Title",
      "",
      "```ts",
      "const list: Array<string> = [];",
      "<NotARealTag>",
      "```",
      "",
      block("Some prose long enough to exceed the fifty character minimum threshold.", 2),
    ].join("\n");

    const { chunks } = chunkMarkdown(text);
    expect(chunks[0].content).toContain("Array<string>");
    expect(chunks[0].content).toContain("<NotARealTag>");
  });
});

describe("isLinkListChunk", () => {
  it("returns true for a pure unordered link-list", () => {
    const text = [
      "- [Zoneless change detection](/guide/zoneless)",
      "- [Linked Signal API](/guide/signals/linked-signal)",
      "- [Incremental hydration](/guide/incremental-hydration)",
      "- [Resource API](/guide/resource)",
      "- [Component testing](/guide/testing/components)",
    ].join("\n");
    expect(isLinkListChunk(text)).toBe(true);
  });

  it("returns true for a pure ordered link-list", () => {
    const text = [
      "1. [Getting started](/guide/start)",
      "2. [Components](/guide/components)",
      "3. [Templates](/guide/templates)",
      "4. [Dependency injection](/guide/di)",
    ].join("\n");
    expect(isLinkListChunk(text)).toBe(true);
  });

  it("returns false for mixed prose and links (below ratio)", () => {
    const text = [
      "This section covers the core Angular features.",
      "You should read these before proceeding to advanced topics.",
      "- [Components](/guide/components)",
      "The framework is designed to be modular and testable.",
    ].join("\n");
    expect(isLinkListChunk(text)).toBe(false);
  });

  it("returns false for prose-only text", () => {
    const text = [
      "Angular is a platform for building web applications.",
      "It provides a comprehensive solution for client-side apps.",
      "The framework uses TypeScript and is maintained by Google.",
    ].join("\n");
    expect(isLinkListChunk(text)).toBe(false);
  });

  it("ignores link-list lines inside fenced code blocks", () => {
    const text = [
      "```markdown",
      "- [Link one](http://example.com)",
      "- [Link two](http://example.com)",
      "- [Link three](http://example.com)",
      "- [Link four](http://example.com)",
      "```",
      "This is regular prose outside the code block that should keep this chunk.",
    ].join("\n");
    expect(isLinkListChunk(text)).toBe(false);
  });

  it("handles link-list items with trailing text (description suffix)", () => {
    const text = [
      "- [Zoneless](/guide/zoneless) — removes zone.js dependency",
      "- [Signals](/guide/signals) — reactive state primitives",
      "- [Hydration](/guide/hydration) — server-side rendering improvement",
    ].join("\n");
    expect(isLinkListChunk(text)).toBe(true);
  });

  it("returns false for empty text", () => {
    expect(isLinkListChunk("")).toBe(false);
  });

  it("exports tunable constants", () => {
    expect(MIN_CHUNK_CHARS).toBe(50);
    expect(LINK_LIST_RATIO).toBe(0.7);
  });
});

describe("chunkMarkdown link-list filtering", () => {
  it("drops a pure link-list chunk", () => {
    const linkList = [
      "## Production ready",
      "",
      "- [Zoneless change detection](/guide/zoneless)",
      "- [Linked Signal API](/guide/signals/linked-signal)",
      "- [Incremental hydration](/guide/incremental-hydration)",
      "- [Resource API](/guide/resource)",
      "- [Component testing guide](/guide/testing/components)",
    ].join("\n");

    const { chunks, droppedCount } = chunkMarkdown(linkList);
    expect(chunks.length).toBe(0);
    expect(droppedCount).toBe(1);
  });

  it("keeps a chunk that mixes prose and links", () => {
    const mixed = [
      "## Overview",
      "",
      "Angular is a platform and framework for building single-page client applications using HTML and TypeScript.",
      "It implements core and optional functionality as a set of TypeScript libraries that you import into your applications.",
      "- [Components](/guide/components)",
      "- [Templates](/guide/templates)",
      "Read the following sections to understand how the pieces fit together.",
    ].join("\n");

    const { chunks, droppedCount } = chunkMarkdown(mixed);
    expect(chunks.length).toBe(1);
    expect(droppedCount).toBe(0);
  });

  it("keeps a link-list inside a fenced code block", () => {
    const codeBlock = [
      "## Example markdown",
      "",
      "Here is what a link list looks like in raw markdown format:",
      "",
      "```markdown",
      "- [Link one](http://example.com)",
      "- [Link two](http://example.com)",
      "- [Link three](http://example.com)",
      "```",
    ].join("\n");

    const { chunks, droppedCount } = chunkMarkdown(codeBlock);
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toContain("Link one");
    expect(droppedCount).toBe(0);
  });

  it("counts droppedCount across multiple dropped chunks", () => {
    const text = [
      "## Index A",
      "",
      "- [Page one](/a/1)",
      "- [Page two](/a/2)",
      "- [Page three](/a/3)",
      "",
      "## Real content",
      "",
      "Angular provides a comprehensive set of tools for building modern web applications.",
      "The framework is maintained by Google and has a large community of contributors worldwide.",
      "",
      "## Index B",
      "",
      "- [Page one](/b/1)",
      "- [Page two](/b/2)",
      "- [Page three](/b/3)",
    ].join("\n");

    const { chunks, droppedCount } = chunkMarkdown(text);
    expect(droppedCount).toBe(2);
    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toContain("Angular provides");
  });
});

describe("golden-query eval: boilerplate corpus", () => {
  // Simulates the Angular llms-full.txt pattern: an index section surrounded by real content sections.
  // Asserts that after chunkMarkdown, index/TOC chunks are absent and real content is retained.
  const angularBoilerplateFixture = [
    "# Angular Developer Guide",
    "",
    "## Introduction",
    "",
    "Angular is a platform and framework for building single-page client applications using HTML and TypeScript.",
    "It implements core and optional functionality as a set of TypeScript libraries that you import into your apps.",
    "The architecture of an Angular application relies on certain fundamental concepts.",
    "",
    "## Production ready",
    "",
    "- [Zoneless change detection](/guide/zoneless)",
    "- [Linked Signal API](/guide/signals/linked-signal)",
    "- [Incremental hydration](/guide/incremental-hydration)",
    "- [Resource API](/guide/resource)",
    "- [Component testing guide](/guide/testing/components)",
    "",
    "## Components",
    "",
    "Components are the main building blocks for Angular applications.",
    "Each component consists of a TypeScript class with a @Component() decorator, an HTML template, and styles.",
    "The @Component() decorator specifies the following Angular-specific information: a CSS selector, an HTML template, and optional CSS styles.",
    "",
    "## Also see",
    "",
    "- [Services and DI](/guide/services)",
    "- [HTTP Client](/guide/http)",
    "- [Router](/guide/router)",
    "- [Forms](/guide/forms)",
    "- [Testing](/guide/testing)",
  ].join("\n");

  it("does not surface index/TOC chunks — only real content chunks survive", () => {
    const { chunks, droppedCount } = chunkMarkdown(angularBoilerplateFixture);

    // Both link-list sections are dropped
    expect(droppedCount).toBe(2);

    // Real content chunks survive
    const contents = chunks.map((c) => c.content);
    expect(contents.some((c) => c.includes("Angular is a platform"))).toBe(true);
    expect(contents.some((c) => c.includes("Components are the main building blocks"))).toBe(true);

    // No chunk should be a pure link list
    for (const c of chunks) {
      expect(isLinkListChunk(c.content)).toBe(false);
    }
  });

  it("a query for 'production ready features' would not match dropped index chunks", () => {
    const { chunks } = chunkMarkdown(angularBoilerplateFixture);

    // The 'Production ready' index section is gone — searching chunks for that heading finds nothing
    const productionIndexChunk = chunks.find(
      (c) => c.heading === "Production ready" && isLinkListChunk(c.content),
    );
    expect(productionIndexChunk).toBeUndefined();
  });

  it("a query for 'components' returns the real components prose chunk, not the also-see index", () => {
    const { chunks } = chunkMarkdown(angularBoilerplateFixture);

    const realComponentsChunk = chunks.find((c) => c.heading === "Components");
    expect(realComponentsChunk).toBeDefined();
    expect(realComponentsChunk!.content).toContain("main building blocks");
  });
});
