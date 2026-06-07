# Embedder

## Role
- Python/FastAPI service that creates vector embeddings and stores them in Postgres.
- Supports synchronous embedding, async background embedding, and query-time embedding.

## Configuration
- `EMBEDDING_PROVIDER`: `openai`, `ollama`, or `huggingface`
- `EMBEDDING_MODEL`
- `OPENAI_API_KEY`
- `OLLAMA_URL`
- `DATABASE_URL`
- `RABBITMQ_URL`
- `SERVER_URL`

## HTTP endpoints

### `GET /health`
- Returns status, provider, model, and dimensions.

### `POST /embed`
- Body:
  - `source_id?`
  - `job_id?`
- Behavior:
  - Queues embedding work in the background.
  - Calls back to `/api/internal/embed-completed` when finished.

### `POST /embed/sync`
- Body:
  - `source_id?`
  - `job_id?`
- Behavior:
  - Processes all pending chunks synchronously.
  - Returns the embedded chunk count.

### `POST /embed/query`
- Body:
  - `text`
- Behavior:
  - Returns a single query vector for search-time use.

### Repo analyzer routes
- `POST /repo-analyzer/embed`
- `POST /repo-analyzer/chunk`
- `GET /repo-analyzer/health`

## Queue behavior
- Consumes `noesis.start-embed-job`.
- Publishes `noesis.embed-completed`.

## Embedding rules
- OpenAI embeddings are batched.
- Ollama embeddings are requested per text.
- HuggingFace dimensions are auto-detected at startup.
- The embedder inserts into `embeddings` with `(chunk_id, model)` uniqueness.
