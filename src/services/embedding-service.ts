import { config } from "../config.js";
import {
  LocalEmbeddingProvider,
  OllamaEmbeddingProvider,
  OpenAIEmbeddingProvider,
  processPendingChunks,
  type EmbeddingProvider,
} from "../embedding/index.js";

let provider: EmbeddingProvider | null = null;

export function getProvider(): EmbeddingProvider {
  if (provider) return provider;

  switch (config.EMBEDDING_PROVIDER) {
    case "openai":
      provider = new OpenAIEmbeddingProvider({
        model: config.EMBEDDING_MODEL,
      });
      break;
    case "ollama":
      provider = new OllamaEmbeddingProvider({
        baseUrl: config.OLLAMA_URL,
        model: config.EMBEDDING_MODEL,
      });
      break;
    default:
      provider = new LocalEmbeddingProvider(config.EMBEDDING_MODEL);
      break;
  }

  return provider;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  return getProvider().embed(texts);
}

export async function embedText(text: string): Promise<number[]> {
  const results = await embedTexts([text]);
  return results[0] ?? [];
}

export async function embedUnembeddedChunks(sourceId?: string): Promise<number> {
  const prov = getProvider();
  return processPendingChunks(prov, sourceId);
}
