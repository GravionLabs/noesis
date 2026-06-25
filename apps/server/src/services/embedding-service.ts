/**
 * EmbeddingService — embedding provider management and batch embedding.
 *
 * Tables (write): embeddings (via processPendingChunks in batch-processor.ts)
 * Tables (read):  chunks (anti-join against embeddings to find unembedded)
 *
 * DB access: delegates to processPendingChunks() in src/embedding/batch-processor.ts
 *   which uses Drizzle ORM with notExists() + onConflictDoNothing().
 *
 * Provider selection (EMBEDDING_PROVIDER env var):
 *   "local"  → Xenova/transformers ONNX (default, no external service)
 *   "openai" → OpenAI embeddings API (requires OPENAI_API_KEY)
 *   "ollama" → Ollama local inference (requires OLLAMA_URL)
 *
 * Key methods:
 *   embedUnembeddedChunks(sourceId?) — process all pending chunks in batches of 100
 *   getProvider()                    — returns the active EmbeddingProvider instance
 */
import type { Config } from "../config/index.js";
import type { Database } from "../db/database.js";
import {
  LocalEmbeddingProvider,
  OllamaEmbeddingProvider,
  OpenAIEmbeddingProvider,
  processPendingChunks,
  type EmbeddingProvider,
} from "../embedding/index.js";

export class EmbeddingService {
  private provider: EmbeddingProvider;
  private database: Database;

  constructor({ config, database }: { config: Config; database: Database }) {
    this.database = database;
    switch (config.EMBEDDING_PROVIDER) {
      case "local":
        this.provider = new LocalEmbeddingProvider(config.EMBEDDING_MODEL);
        break;
      case "openai":
        this.provider = new OpenAIEmbeddingProvider({
          apiKey: config.OPENAI_API_KEY || undefined,
          model: config.EMBEDDING_MODEL,
        });
        break;
      case "ollama":
        this.provider = new OllamaEmbeddingProvider({
          baseUrl: config.OLLAMA_URL,
          model: config.EMBEDDING_MODEL,
        });
        break;
      default:
        this.provider = new LocalEmbeddingProvider(config.EMBEDDING_MODEL);
        break;
    }
  }

  getProvider(): EmbeddingProvider {
    return this.provider;
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    return this.provider.embed(texts);
  }

  async embedText(text: string): Promise<number[]> {
    const results = await this.embedTexts([text]);
    return results[0] ?? [];
  }

  async embedUnembeddedChunks(sourceId?: string): Promise<number> {
    return processPendingChunks(this.database, this.provider, sourceId);
  }
}
