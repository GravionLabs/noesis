import { describe, it, expect } from "vitest";
import { OpenAIEmbeddingProvider } from "../../src/embedding/openai.js";

describe("OpenAIEmbeddingProvider", () => {
  it("constructs with defaults", () => {
    const p = new OpenAIEmbeddingProvider();
    expect(p.model).toBe("text-embedding-3-small");
    expect(p.dimensions).toBe(1536);
    expect(typeof p.embed).toBe("function");
  });

  it("constructs with custom model", () => {
    const p = new OpenAIEmbeddingProvider({ model: "text-embedding-3-large" });
    expect(p.model).toBe("text-embedding-3-large");
    expect(p.dimensions).toBe(1536);
  });

  it("implements EmbeddingProvider interface", () => {
    const p = new OpenAIEmbeddingProvider();
    expect(typeof p.embed).toBe("function");
    expect(typeof p.model).toBe("string");
    expect(typeof p.dimensions).toBe("number");
  });
});
