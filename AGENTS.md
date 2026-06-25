# AGENTS.md — Noesis Agent Architecture

Single TypeScript runtime: Fastify server with embedded embedding pipeline.

---

## Architecture

```mermaid
graph TD
    Client(["MCP Client / IDE"])
    Server["TypeScript Server\n(Fastify + MCP + REST API)"]
    Crawler["Node.js Crawler\n(Playwright)"]
    DB[("Postgres + pgvector")]

    Client -- "MCP tools" --> Server
    Client -- "REST API" --> Server
    Server -- "POST /jobs/crawl" --> Crawler
    Crawler -- "write chunks" --> DB
    Server -- "read/write" --> DB
```

## Quick Start

```bash
docker compose -f infra/docker-compose.yml up -d
```

Or without Docker for Postgres:

```bash
pnpm install && pnpm dev
```

See [`infra/README.md`](infra/README.md) for port reference.

---

## Components

### TypeScript Server (`src/`)

**Role:** MCP server, REST API, import pipeline, embedding.

| Module | Responsibility |
|---|---|
| `src/routes/` | REST API — sources, jobs, health, internal callbacks |
| `src/mcp/` | MCP tools: `search_docs`, `get_chunk`, `list_sources` |
| `src/importers/` | 8 importer types (llmstxt, npm-readme, openapi, github, ...) |
| `src/pipeline/` | Job runner + scheduler |
| `src/embedding/` | Embedding providers (local ONNX, Ollama, OpenAI) |
| `src/search/` | Text + vector search orchestrator |

### Node.js Crawler (`crawler/`)

**Role:** Playwright-based web crawler.

| Endpoint | Description |
|---|---|
| `GET /health` | Health check (crawler service — separate from server's `/healthz/*`) |
| `POST /jobs/crawl` | Crawl a URL with Playwright |

After completion, the crawler writes chunks directly to Postgres.

---

## Import Pipeline

```
1. Register source  →  POST /api/sources
2. Trigger import   →  POST /api/sources/{id}/import
3. runImport()      →  selects importer by type
4a. In-process:     →  fetches + chunks + stores in Postgres
4b. Crawler-based:  →  POST /jobs/crawl → Node.js (async, polls for chunks)
5. embedUnembeddedChunks() → local/ollama/openai → pgvector
6. Job marked done, source.LastImportedAt updated
```

---

## MCP Tools

| Tool | Description | Parameters |
|---|---|---|
| `search_docs` | Semantic + text search with fallback | `query: string`, `limit?: int`, `source?: string` |
| `get_chunk` | Retrieve a chunk by UUID | `chunkId: string` |
| `list_sources` | List all registered sources | — |

All tools are **read-only** and **idempotent**.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://noesis:noesis_dev@localhost:5442/noesis` | Postgres connection string |
| `EMBEDDING_PROVIDER` | `local` | `local`, `ollama`, or `openai` |
| `EMBEDDING_MODEL` | `Xenova/bge-base-en-v1.5` | Embedding model name |
| `CRAWLER_URL` | `http://localhost:3001` | Node.js crawler base URL |
| `OPENAI_API_KEY` | — | Required when provider is `openai` |
| `OLLAMA_URL` | `http://localhost:11434` | Required when provider is `ollama` |

---

## Copilot CLI MCP Configuration

Add to `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "noesis": {
      "type": "http",
      "url": "http://localhost:5000/mcp",
      "tools": ["search_docs", "get_chunk", "list_sources"]
    }
  }
}
```

Restart Copilot CLI or run `/mcp` to reload.
