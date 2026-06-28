# Product Overview

## What is Noesis?

Noesis is a self-hosted documentation context engine. It crawls, chunks, and embeds documentation from any source into Postgres + pgvector, then exposes the indexed content as:

- **MCP tools** — for use in GitHub Copilot CLI, VS Code, and any MCP-compatible AI assistant
- **REST API** — for programmatic search and source management
- **Angular web UI** — for managing sources, monitoring import jobs, and running ad-hoc searches

---

## Core Capabilities

| Capability | Description |
|---|---|
| **Multi-source ingestion** | 8 importer types covering llms.txt, Playwright crawl, GitHub, npm, OpenAPI, Azure DevOps |
| **Semantic search** | pgvector similarity search with keyword fallback |
| **MCP integration** | `search_docs`, `get_chunk`, `list_sources` tools via the `/mcp` HTTP endpoint |
| **REST API** | Full CRUD for sources, job management, search — see `specs/api-contracts.md` |
| **Angular web UI** | Dashboard, source management, job monitoring with real-time logs, query interface |
| **Scheduled imports** | Per-source cron schedule for automatic re-indexing |
| **Incremental crawling** | Content-hash comparison skips unchanged pages to reduce re-import cost |
| **Job cancellation** | In-flight imports can be cancelled; partial results are preserved |
| **Embedding flexibility** | Local ONNX (zero setup), Ollama, or OpenAI |

---

## Clients

| Client | Access method |
|---|---|
| GitHub Copilot CLI | MCP over HTTP (`/mcp`) |
| VS Code (MCP extension) | MCP over HTTP (`/mcp`) |
| Any MCP-compatible AI | MCP over HTTP (`/mcp`) |
| Angular web UI | REST API (`/api/*`) — included in the Docker image |
| CLI / scripts | REST API (`/api/*`) |

---

## Search Endpoint

```
GET /api/search?q=<query>&source=<sourceId>&limit=<n>
```

Returns ranked chunks with `chunkId`, `sourceName`, `docTitle`, `docUrl`, `heading`, `content`, and `score`. Also available as the `search_docs` MCP tool.

---

## Settings & Authentication

The UI includes a Settings page (`/settings`) for configuring:
- **API Key** — stored in `localStorage`, sent as `x-api-key` on every request
- **Server URL** — useful when the UI is hosted separately from the API
- **Theme** — light / dark / system

The REST API and MCP endpoint are unauthenticated by default. Set the `API_KEY` environment variable to require the `x-api-key` header on all requests.

---

## Further Reading

| Document | Description |
|---|---|
| [`specs/api-contracts.md`](api-contracts.md) | Full REST API reference |
| [`specs/import-pipeline.md`](import-pipeline.md) | Import flow, job states, retry logic |
| [`specs/crawler.md`](crawler.md) | Embedded Playwright crawler behaviour |
| [`specs/infrastructure.md`](infrastructure.md) | Services, ports, environment variables |
| [`docs/ui.md`](../docs/ui.md) | Angular UI setup and page reference |
| [`AGENTS.md`](../AGENTS.md) | Architecture and MCP tool reference |
