# Noesis

Self-hosted documentation context engine — crawl, embed, and query your docs via MCP.
Index any documentation source into Postgres + pgvector and expose it as MCP tools
for use in GitHub Copilot CLI, VS Code, and any MCP-compatible client.

**Stack:** TypeScript (Fastify) · Playwright (embedded) · Postgres + pgvector

Canonical behavior, contracts, and workflows live in [`specs/`](specs/).

---

## Architecture

```mermaid
graph TD
    Client["MCP Client / IDE"]
    Server["TypeScript Server (Fastify + MCP + REST API)\nPlaywright Crawler (embedded)\nEmbedding (local/ollama/openai)"]
    DB["Postgres + pgvector"]

    Client -- "MCP tools" --> Server
    Client -- "REST API" --> Server
    Server -- "read/write" --> DB
```

```
noesis/
├── apps/server/src/   TypeScript server — MCP, REST API, crawler, embedding
├── apps/ui/           Angular web UI
└── infra/             Docker Compose
```

---

## Quick Start

### Prerequisites

- Docker Desktop (macOS/Windows) or Docker Engine + Compose (Linux)
- pnpm (for local development without Docker)

### Docker Compose (recommended)

```bash
docker compose -f infra/docker-compose.yml up -d
```

This starts:
- **Postgres + pgvector** on port `5442`
- **Seq** on port `5341` (API) / `5380` (UI)
- **Server** (Fastify + MCP + Playwright crawler + embedding) on port `5000`

### Local development

```bash
# Start Postgres only
docker compose -f infra/docker-compose.yml up -d postgres

# Install dependencies and run
pnpm install
pnpm dev
```

---

## Import Pipeline

1. **Register source** — `POST /api/sources` with name, URL, and importer type
2. **Trigger import** — `POST /api/sources/{id}/import`
3. Importers fetch + chunk + store in Postgres (some use embedded Playwright for crawling)
4. Embeddings generated automatically (local ONNX, Ollama, or OpenAI)
5. Job marked done, source ready for search

### Importer Types

| Type | Description | Example URL |
|---|---|---|
| `llmstxt` | Fetches `llms-full.txt`, chunks by heading | `https://next.angular.dev/assets/context/llms-full.txt` |
| `llmstxt-meta` | Fetches `llms.txt`, extracts metadata | `https://next.angular.dev/llms.txt` |
| `llmstxt-crawl` | Fetches `llms.txt`, crawls each linked page | `https://next.angular.dev/llms.txt` |
| `crawler` | Playwright docs crawl | `https://angular.dev/guide` |
| `github` | GitHub repository README | `https://github.com/angular/angular` |
| `npm-readme` | npm package README | `https://registry.npmjs.org/lodash` |
| `openapi` | OpenAPI JSON spec | `https://api.example.com/openapi.json` |
| `azuredevops` | Azure DevOps wiki / repo | `https://dev.azure.com/org/project` |

### Example: Index Angular docs

```bash
# Register source
curl -X POST http://localhost:5000/api/sources \
  -H 'Content-Type: application/json' \
  -d '{"name":"Angular","url":"https://next.angular.dev/assets/context/llms-full.txt","importerType":"llmstxt"}'

# Trigger import (returns jobId)
curl -X POST http://localhost:5000/api/sources/<id>/import

# Poll status
curl http://localhost:5000/api/jobs/<jobId>
```

---

## MCP Tools

| Tool | Description | Parameters |
|---|---|---|
| `search_docs` | Semantic + text search with fallback | `query`, `limit?`, `source?` |
| `get_chunk` | Retrieve a specific chunk by UUID | `chunkId` |
| `list_sources` | List all registered sources | — |

All tools are **read-only** and **idempotent**.

### Use with GitHub Copilot CLI

1. Start the server: `docker compose -f infra/docker-compose.yml up -d` or `pnpm dev`
2. Create `~/.copilot/mcp-config.json`:

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

3. Run `/mcp` in the Copilot CLI to verify the connection.

---

## Configuration & Security

Copy [`apps/server/.env.example`](apps/server/.env.example) to `.env` and adjust as needed.
All variables are validated in `apps/server/src/config/index.ts`.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Server port |
| `DATABASE_URL` | `postgres://noesis:noesis_dev@localhost:5442/noesis` | Postgres connection string |
| `EMBEDDING_PROVIDER` | `local` | `local`, `ollama`, or `openai` |
| `EMBEDDING_MODEL` | `Xenova/bge-base-en-v1.5` | Embedding model name |
| `EMBEDDING_DIMENSIONS` | `768` | Vector dimensions for the chosen model |
| `OPENAI_API_KEY` | — | Required when provider is `openai` |
| `OLLAMA_URL` | `http://localhost:11434` | Required when provider is `ollama` |
| `GITHUB_TOKEN` | — | Used by the `github` importer/provider |
| `AZURE_DEVOPS_TOKEN` / `AZURE_DEVOPS_ORG` | — | Used by the `azuredevops` importer |
| `API_KEY` | — | Shared secret for the `x-api-key` header — see below |
| `SERVER_URL` | `http://localhost:5000` | Public base URL of this server |
| `LOG_LEVEL` | `info` | `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `LOG_SINK` | `stdout` | `stdout`, `seq`, or `ecs` |
| `MAX_IMPORT_RETRIES` | `3` | Max retry attempts for a failed import job |
| `SERVE_UI` | `true` | Whether to serve the built Angular UI |

### Authentication

`API_KEY` is **empty by default**, which means the REST API and the `/mcp` endpoint
are **unauthenticated**. This is intended for trusted, localhost-only setups.

For any deployment reachable beyond localhost, set `API_KEY` and send it as the
`x-api-key` header on every request:

```bash
curl -H 'x-api-key: <your-key>' http://localhost:5000/api/sources
```

### Other defaults

- **Rate limiting**: 100 requests/minute per client, enabled by default.
- **CORS**: enabled with `origin: true` (reflects the request origin) by default.

---

## Angular UI

Noesis ships with an Angular 21 web UI built with `@gravionlabs/helix` and PrimeNG.

```bash
pnpm --filter ui dev   # dev server on port 4200, proxies /api/* to the server
```

See [docs/ui.md](docs/ui.md) for full setup, page reference, and build instructions.
When using Docker Compose the UI is served by the Fastify server on port `5000` alongside the API.

---

## License

[MIT](LICENSE)

---

## Further Reading

| Document | Description |
|---|---|
| [`specs/README.md`](specs/README.md) | Canonical spec collection and reading order |
| [`AGENTS.md`](AGENTS.md) | Full architecture, environment variables, pipeline flow |
| [`infra/README.md`](infra/README.md) | Port reference, connection strings, Docker setup |
| [`CHANGELOG.md`](CHANGELOG.md) | Release history, generated from conventional commits via `pnpm changelog` |
