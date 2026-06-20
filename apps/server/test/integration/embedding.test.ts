import { describe, it, expect } from "vitest";
import { LocalEmbeddingProvider } from "../../src/embedding/local.js";

describe("LocalEmbeddingProvider (integration)", () => {
  it("embeds text with fallback model", async () => {
    const p = new LocalEmbeddingProvider("Xenova/all-MiniLM-L6-v2");
    const result = await p.embed(["hello world"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(384);
    expect(typeof result[0][0]).toBe("number");
  });
});
