import { describe, it, expect } from "vitest";
import { LocalEmbeddingProvider } from "../../src/embedding/local.js";

describe("LocalEmbeddingProvider", () => {
  it("has default model and dimensions", () => {
    const p = new LocalEmbeddingProvider();
    expect(p.model).toBe("Xenova/bge-base-en-v1.5");
    expect(p.dimensions).toBe(768);
  });

  it("accepts custom model", () => {
    const p = new LocalEmbeddingProvider("Xenova/all-MiniLM-L6-v2");
    expect(p.model).toBe("Xenova/all-MiniLM-L6-v2");
    expect(p.dimensions).toBe(384);
  });

  it("implements EmbeddingProvider interface", () => {
    const p = new LocalEmbeddingProvider();
    expect(typeof p.embed).toBe("function");
    expect(typeof p.model).toBe("string");
    expect(typeof p.dimensions).toBe("number");
  });
});
