import type { Config } from "../config/index.js";
import {
  LocalEmbeddingProvider,
  OllamaEmbeddingProvider,
  OpenAIEmbeddingProvider,
  processPendingChunks,
  type EmbeddingProvider,
} from "../embedding/index.js";

export class EmbeddingService {
  private provider: EmbeddingProvider;

  constructor({ config }: { config: Config }) {
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
    return processPendingChunks(this.provider, sourceId);
  }
}
