export type { EmbeddingProvider } from "./provider.js";
export { LocalEmbeddingProvider } from "./local.js";
export { OllamaEmbeddingProvider } from "./ollama.js";
export { OpenAIEmbeddingProvider } from "./openai.js";
export { processPendingChunks, countPendingChunks } from "./batch-processor.js";
