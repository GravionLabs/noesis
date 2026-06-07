import { describe, it, expect } from "vitest";

describe("embedding module exports", () => {
  it("exports LocalEmbeddingProvider", async () => {
    const mod = await import("../../src/embedding/index.js");
    expect(mod.LocalEmbeddingProvider).toBeDefined();
    expect(typeof mod.LocalEmbeddingProvider).toBe("function");
  });

  it("exports OllamaEmbeddingProvider", async () => {
    const mod = await import("../../src/embedding/index.js");
    expect(mod.OllamaEmbeddingProvider).toBeDefined();
    expect(typeof mod.OllamaEmbeddingProvider).toBe("function");
  });

  it("exports OpenAIEmbeddingProvider", async () => {
    const mod = await import("../../src/embedding/index.js");
    expect(mod.OpenAIEmbeddingProvider).toBeDefined();
    expect(typeof mod.OpenAIEmbeddingProvider).toBe("function");
  });

  it("exports processPendingChunks and countPendingChunks", async () => {
    const mod = await import("../../src/embedding/index.js");
    expect(typeof mod.processPendingChunks).toBe("function");
    expect(typeof mod.countPendingChunks).toBe("function");
  });

  it("exports EmbeddingProvider type", async () => {
    const mod = await import("../../src/embedding/index.js");
    expect(mod.EmbeddingProvider).toBeUndefined(); // type-only export
  });
});
