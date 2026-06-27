import type { EmbeddingProvider } from "./provider.js";

const DEFAULT_MODEL = "Xenova/bge-base-en-v1.5";
const DEFAULT_DIMS = 768;

const FALLBACK_MODEL = "Xenova/all-MiniLM-L6-v2";
const FALLBACK_DIMS = 384;

interface Extractor {
  (text: string, options: { pooling: "mean"; normalize: boolean }): Promise<{ data: Float32Array }>;
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimensions: number;
  private extractor: Extractor | null = null;

  constructor(model?: string) {
    this.model = model ?? DEFAULT_MODEL;
    this.dimensions = this.model === FALLBACK_MODEL ? FALLBACK_DIMS : DEFAULT_DIMS;
  }

  async health(): Promise<boolean> {
    return true;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const ext = await this.getExtractor();
    const results: number[][] = [];
    for (const text of texts) {
      const output = await ext(text, { pooling: "mean", normalize: true });
      results.push(Array.from(output.data));
    }
    return results;
  }

  private async getExtractor(): Promise<Extractor> {
    if (this.extractor) return this.extractor;
    try {
      this.extractor = await this.loadExtractor(this.model);
      return this.extractor;
    } catch {
      if (this.model !== FALLBACK_MODEL) {
        console.warn("Local model %s failed, falling back to %s", this.model, FALLBACK_MODEL);
        this.extractor = await this.loadExtractor(FALLBACK_MODEL);
        return this.extractor;
      }
      throw new Error("Both primary and fallback local embedding models failed to load");
    }
  }

  private async loadExtractor(model: string): Promise<Extractor> {
    const { pipeline } = await import("@xenova/transformers");
    const pipe = await pipeline("feature-extraction", model);
    return async (text: string, options: { pooling: "mean"; normalize: boolean }) => {
      const result = await pipe(text, options);
      return { data: result.data as unknown as Float32Array };
    };
  }
}
