import { describe, it, expect, vi } from "vitest";
import { OllamaEmbeddingProvider } from "../../src/embedding/ollama.js";

describe("OllamaEmbeddingProvider", () => {
  it("constructs with defaults", () => {
    const p = new OllamaEmbeddingProvider();
    expect(p.model).toBe("nomic-embed-text");
    expect(p.dimensions).toBe(768);
    expect(typeof p.embed).toBe("function");
  });

  it("constructs with custom config", () => {
    const p = new OllamaEmbeddingProvider({
      baseUrl: "http://ollama:11434",
      model: "mxbai-embed-large",
    });
    expect(p.model).toBe("mxbai-embed-large");
  });

  it("throws on non-ok response", async () => {
    const p = new OllamaEmbeddingProvider({ baseUrl: "http://localhost:1" });
    await expect(p.embed(["test"])).rejects.toThrow();
  });

  it("throws on missing embedding in response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    const p = new OllamaEmbeddingProvider({ baseUrl: "http://test:11434" });
    await expect(p.embed(["test"])).rejects.toThrow("Ollama returned no embedding");

    vi.stubGlobal("fetch", undefined);
  });
});
