# Embedder (superseded)

> The standalone Python embedder has been replaced by the in-process embedding module
> at `src/embedding/`. See `src/embedding/provider.ts` for the `EmbeddingProvider` interface
> and `src/services/embedding-service.ts` for the active embedding service.

## Original role (archived)

The Python/FastAPI service (`embedder/`) was a standalone embedding pipeline that
consumed RabbitMQ messages and wrote vectors to pgvector. It supported OpenAI, Ollama,
and HuggingFace providers via HTTP endpoints.

All functionality is now provided natively in the TypeScript server:
- `LocalEmbeddingProvider` — ONNX inference via `@xenova/transformers`
- `OllamaEmbeddingProvider` — HTTP client to local Ollama instance
- `OpenAIEmbeddingProvider` — OpenAI API client
- `processPendingChunks()` — batched embedding of unembedded chunks
