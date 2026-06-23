import { describe, it, expect } from "vitest";
import { chunkMarkdown } from "../../src/importers/chunk-utils.js";

function block(text: string, n = 3): string {
  return (text + "\n").repeat(n);
}

describe("chunkMarkdown", () => {
  it("chunks long text without headings", () => {
    const text = block("This is a paragraph with enough content to exceed the 50-character minimum threshold for chunk creation.", 100);
    const chunks = chunkMarkdown(text);
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

    const chunks = chunkMarkdown(text);
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

    const chunks = chunkMarkdown(text);
    expect(chunks[0].headingPath).toEqual(["H1"]);
    expect(chunks[1].headingPath).toEqual(["H1", "H2"]);
    expect(chunks[2].headingPath).toEqual(["H1", "H2", "H3"]);
    expect(chunks[3].headingPath).toEqual(["H1", "H2b"]);
  });

  it("discards chunks with <= 50 chars", () => {
    const text = "# H1\n\nshort";
    const chunks = chunkMarkdown(text);
    expect(chunks.length).toBe(0);
  });

  it("returns empty array for empty input", () => {
    expect(chunkMarkdown("")).toEqual([]);
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

    const chunks = chunkMarkdown(text);
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

    const chunks = chunkMarkdown(text);
    expect(chunks[0].content).toContain("Array<string>");
    expect(chunks[0].content).toContain("<NotARealTag>");
  });
});
