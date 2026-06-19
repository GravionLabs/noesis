import type { EmbeddingProvider } from "./provider.js";

export interface OpenAIConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly apiKey: string | undefined;
  readonly model: string;
  readonly dimensions: number;

  constructor(config?: OpenAIConfig) {
    this.apiKey = config?.apiKey;
    this.model = config?.model ?? "text-embedding-3-small";
    this.dimensions = 1536;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: this.apiKey });
    const response = await client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  }
}
