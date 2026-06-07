# Crawler

## Role
- Node.js/TypeScript worker that crawls documentation sources and persists chunks.
- Handles both direct page crawls and `llms.txt`-driven page expansion.

## HTTP endpoints

### `GET /health`
- Returns `{"status":"ok"}`.

### `POST /jobs/crawl`
- Body:
  - `jobId`
  - `sourceId`
  - `url`
  - `type`
  - `config?`
- Behavior:
  - Normalizes crawl config.
  - Crawls the target URL.
  - Saves chunks to Postgres.
  - Publishes `CrawlCompleted` to RabbitMQ.
- Response: `202 Accepted` with `jobId` and `status: accepted`.

### `POST /jobs/ingest-llmstxt`
- Body:
  - `jobId`
  - `sourceId`
  - `url`
- Behavior:
  - Fetches an `llms-full.txt` document.
  - Chunks and stores extracted content.
  - Publishes `CrawlCompleted` to RabbitMQ.
- Response: `202 Accepted` with `jobId` and `status: accepted`.

### `POST /jobs/crawl-llmstxt`
- Body:
  - `jobId`
  - `sourceId`
  - `url`
  - `includeOptional?`
- Behavior:
  - Fetches and parses `llms.txt`.
  - Expands linked URLs, optionally including `Optional` entries.
  - Crawls pages with limited concurrency.
  - Saves chunks and publishes `CrawlCompleted`.

## Queue behavior
- Consumes from `noesis.start-crawl-job`.
- Publishes to `noesis.crawl-completed`.
- Messages use JSON payloads.

## Persistence
- Upserts `docs` by `(source_id, url)`.
- Inserts `chunks` with duplicate avoidance by conflict handling.

## Crawl config
- `maxDepth`
- `maxPages`
- `crawlDelayMs`
- `allowedPathPrefixes`
- `excludePathPrefixes`
