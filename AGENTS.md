# AGENTS.md — Noesis Agent Architecture

Single TypeScript runtime: Fastify server with embedded Playwright crawler and in-process embedding.

---

## Architecture

```mermaid
graph TD
    Client(["MCP Client / IDE"])
    Server["TypeScript Server\n(Fastify + MCP + REST API)\nPlaywright Crawler (embedded)\nEmbedding (local/ollama/openai)"]
    DB[("Postgres + pgvector")]

    Client -- "MCP tools" --> Server
    Client -- "REST API" --> Server
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

### TypeScript Server (`apps/server/src/`)

**Role:** MCP server, REST API, import pipeline, Playwright crawler, embedding.

| Module | Responsibility |
|---|---|
| `apps/server/src/routes/` | REST API — sources, jobs, health, internal callbacks |
| `apps/server/src/mcp/` | MCP tools: `search_docs`, `get_chunk`, `list_sources` |
| `apps/server/src/importers/` | 10 importer types (llmstxt, npm-readme, openapi, github, azuredevops, ...) |
| `apps/server/src/pipeline/` | Job runner + scheduler |
| `apps/server/src/crawler/` | Playwright-based web crawler (embedded) |
| `apps/server/src/embedding/` | Embedding providers (local ONNX, Ollama, OpenAI) |
| `apps/server/src/search/` | Text + vector search orchestrator |

The Playwright crawler runs **in-process** — no separate service, no HTTP endpoint for crawling.

---

## Import Pipeline

```
1. Register source  →  POST /api/sources
2. Trigger import   →  POST /api/sources/{id}/import
3. runImport()      →  selects importer by type
4. Fetches + chunks + stores in Postgres
5. embedUnembeddedChunks() → local/ollama/openai → pgvector
6. Job marked done, source.LastImportedAt updated
```

---

## MCP Tools

| Tool | Description | Parameters | Notes |
|---|---|---|---|
| `search_docs` | Semantic + text search with fallback | `query: string`, `limit?: int`, `source?: string` | Exposed via REST at `GET /api/search` |
| `get_chunk` | Retrieve a chunk by UUID | `chunkId: string` | **MCP-only** — not exposed via REST API or web UI |
| `list_sources` | List all registered sources | — | Exposed via REST at `GET /api/sources` |

All tools are **read-only** and **idempotent**.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://noesis:noesis_dev@localhost:5442/noesis` | Postgres connection string |
| `EMBEDDING_PROVIDER` | `local` | `local`, `ollama`, or `openai` |
| `EMBEDDING_MODEL` | `Xenova/bge-base-en-v1.5` | Embedding model name |
| `OPENAI_API_KEY` | — | Required when provider is `openai` |
| `OLLAMA_URL` | `http://localhost:11434` | Required when provider is `ollama` |

> `CRAWLER_URL` does not exist — the crawler is embedded in the server process.

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
