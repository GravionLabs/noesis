import type { EmbeddingProvider } from "./provider.js";

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  private readonly baseUrl: string;

  constructor(config?: OllamaConfig) {
    this.baseUrl = config?.baseUrl ?? "http://localhost:11434";
    this.model = config?.model ?? "nomic-embed-text";
    this.dimensions = 768;
  }

  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { method: "GET", signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, prompt: text }),
      });
      if (!res.ok) throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
      const data = (await res.json()) as { embedding?: number[] };
      if (!data.embedding) throw new Error("Ollama returned no embedding");
      results.push(data.embedding);
    }
    return results;
  }
}
