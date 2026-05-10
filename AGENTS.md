# AGENTS.md – Noesis Agent Architecture

This document describes the Noesis system architecture, component roles,
inter-service communication, and how to bootstrap the first use case (Angular documentation).

---

## Prerequisites / Local Setup

### Podman as Docker Backend (Linux)

The `docker` CLI is a Podman emulator. Enable the system-level Podman socket **once**:

```bash
sudo systemctl enable --now podman.socket
```

Verify: `docker info` — should show Podman info without errors.

**Alternative (rootless):** `systemctl --user enable --now podman.socket` + `export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"`

### Start the dev stack

```bash
docker compose -f infra/docker-compose.yml up -d
```

See [`infra/README.md`](infra/README.md) for port reference and connection strings.

---

## Architecture Overview

```mermaid
graph TD
    Client(["MCP Client / IDE"])
    Server["🔷 .NET Server\n(MCP + REST API + Orchestration)"]
    Crawler["🟨 Node.js Crawler\n(Playwright + llms-full.txt ingest)"]
    Embedder["🐍 Python Embedder\n(OpenAI / Ollama → pgvector)"]
    DB[("🐘 Postgres + pgvector")]
    RabbitMQ["🐰 RabbitMQ\n(Wolverine Saga)"]

    Client -- "MCP tools" --> Server
    Client -- "REST API" --> Server

    Server -- "POST /jobs/crawl" --> Crawler
    Server -- "POST /jobs/ingest-llmstxt" --> Crawler
    Server -- "POST /embed" --> Embedder
    Server <-- "POST /api/jobs/{id}/complete" --- Crawler
    Server <-- "POST /api/internal/embed-completed" --- Embedder

    Server -- "read/write" --> DB
    Crawler -- "write chunks" --> DB
    Embedder -- "write vectors" --> DB

    Server -- "Wolverine Saga" --> RabbitMQ
```

---

## Components

### 🔷 `.NET Server` (`server/`)

**Role:** Orchestrator, MCP server, REST API, import pipeline controller.

| Responsibility | Details |
|---|---|
| MCP Tools | `search_docs`, `get_chunk`, `list_sources` via `ContextTools.cs` |
| REST API | `POST /api/sources`, `POST /api/sources/{id}/import`, `GET /api/jobs/{id}` |
| Orchestration | Wolverine Saga (`ImportJobSaga`): import → embed → done |
| Importers | `llmstxt` (llms-full.txt), `llmstxt-meta` (llms.txt metadata), `llmstxt-crawl` (llms.txt → crawl links), `crawler`, `github`, `azuredevops` |
| Scheduling | Hangfire with cron expressions per source |
| Database | EF Core + Npgsql + pgvector |

**Importer Types:**

| Type | Description | Source URL Example |
|---|---|---|
| `llmstxt` | Fetches llms-full.txt, chunks by H2, stores docs+chunks | `https://next.angular.dev/assets/context/llms-full.txt` |
| `llmstxt-meta` | Fetches SHORT llms.txt, extracts metadata into `sources.config` | `https://next.angular.dev/llms.txt` |
| `llmstxt-crawl` | Fetches SHORT llms.txt, crawls each linked page via Playwright (Node.js) | `https://next.angular.dev/llms.txt` |
| `crawler` | Delegates to Node.js Playwright crawler | `https://angular.dev/guide` |
| `github` | Fetches GitHub README via API | `https://github.com/angular/angular` |
| `azuredevops` | Azure DevOps wiki / repo crawling | `https://dev.azure.com/org/project` |
| `npm-readme` | Fetches package README from npm registry JSON API | `https://registry.npmjs.org/angular` |
| `openapi` | Fetches OpenAPI JSON spec, stores each operation as a chunk | `https://api.example.com/openapi.json` |

---

### 🟨 `Node.js Crawler` (`crawler/`)

**Role:** Playwright-based web crawler and llms-full.txt ingest worker.

| Endpoint | Description |
|---|---|
| `GET /health` | Health check |
| `POST /jobs/crawl` | Body: `{ jobId, sourceId, url, type }` — Playwright/GitHub crawl |
| `POST /jobs/ingest-llmstxt` | Body: `{ jobId, sourceId, url }` — llms-full.txt HTTP fetch + chunk + store |

After completion, the crawler calls back: `POST $SERVER_URL/api/jobs/{jobId}/complete`

---

### 🐍 `Python Embedder` (`embedder/`)

**Role:** Creates vector embeddings for unembedded chunks and stores them in pgvector.

| Endpoint | Description |
|---|---|
| `GET /health` | Health check + provider info |
| `POST /embed` | Body: `{ source_id? }` — async background embedding |
| `POST /embed/sync` | Body: `{ source_id? }` — synchronous embedding, returns `{ embedded: N }` |

Supports `openai` (default) and `ollama` providers via `EMBEDDING_PROVIDER` env var.
After completion, calls back: `POST $SERVER_URL/api/internal/embed-completed`

---

## Import Pipeline Flow

```
1. Register source  →  POST /api/sources
2. Trigger import   →  POST /api/sources/{id}/import
3. .NET Saga starts → selects importer by type
4a. llmstxt:        → LlmsTxtImporter fetches + chunks → Postgres (in-process)
4b. crawler:        → CrawlerImporter → POST /jobs/crawl → Node.js (async callback)
4c. ingest-llmstxt: → CrawlerImporter → POST /jobs/ingest-llmstxt → Node.js (async callback)
5. Saga receives ImportCompleted / CrawlCompleted
6. Saga → POST /embed → Python Embedder
7. Python Embedder writes vectors → Postgres
8. Python Embedder → POST /api/internal/embed-completed
9. Saga marks job done, updates source.LastImportedAt
```

---

## Use Case 1: Angular Documentation

### Step 1 – Register Angular llms-full.txt source

```bash
curl -X POST http://localhost:5000/api/sources \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Angular",
    "url": "https://next.angular.dev/assets/context/llms-full.txt",
    "importerType": "llmstxt"
  }'
```

Expected response:
```json
{
  "id": "<uuid>",
  "name": "Angular",
  "url": "https://next.angular.dev/assets/context/llms-full.txt",
  "importerType": "llmstxt",
  "enabled": true
}
```

### Step 2 – Trigger import

```bash
SOURCE_ID="<uuid from step 1>"
curl -X POST http://localhost:5000/api/sources/$SOURCE_ID/import
```

Expected response (`202 Accepted`):
```json
{ "jobId": "<job-uuid>" }
```

### Step 3 – Poll job status

```bash
JOB_ID="<job-uuid>"
curl http://localhost:5000/api/jobs/$JOB_ID
```

The job progresses through: `pending` → `running` → `embedding` → `done`

### Step 4 – Register Angular metadata source (optional)

```bash
curl -X POST http://localhost:5000/api/sources \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Angular Metadata",
    "url": "https://next.angular.dev/llms.txt",
    "importerType": "llmstxt-meta"
  }'
```

Trigger its import with `POST /api/sources/{id}/import`.
Metadata (title, description, links) is stored in `sources.config` as JSON.

### Step 4b – Crawl sub-pages from llms.txt (alternative to llms-full.txt)

Instead of importing the single pre-built `llms-full.txt`, you can crawl each page linked
from `llms.txt` individually via Playwright. This picks up pages not included in `llms-full.txt`.

```bash
curl -X POST http://localhost:5000/api/sources \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Angular Docs (crawled)",
    "url": "https://next.angular.dev/llms.txt",
    "importerType": "llmstxt-crawl",
    "config": "{\"includeOptional\": false}"
  }'
```

Set `includeOptional: true` in `config` to also crawl pages listed under `## Optional`.
Trigger import with `POST /api/sources/{id}/import`. The crawler calls back asynchronously.

### Step 5 – Test MCP search

```bash
# Via MCP HTTP transport
curl -X POST http://localhost:5000/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "id": 1,
    "params": {
      "name": "search_docs",
      "arguments": { "query": "Angular dependency injection", "limit": 3 }
    }
  }'
```

---

## MCP Tools Reference

| Tool Name | Description | Parameters |
|---|---|---|
| `search_docs` | Semantic similarity search over all indexed chunks | `query: string`, `limit?: int`, `source?: string` |
| `get_chunk` | Retrieve a specific chunk by UUID | `chunkId: string` |
| `list_sources` | List all registered sources | — |

All tools are **read-only** and **idempotent**.

---

## Environment Variables

### .NET Server

| Variable | Default | Description |
|---|---|---|
| `ConnectionStrings__noesis` | — | Postgres connection string |
| `Services__CrawlerUrl` | `http://crawler:3000` | Node.js crawler base URL |
| `Services__EmbedderUrl` | `http://embedder:8000` | Python embedder base URL |
| `RabbitMq__Host` | `localhost` | RabbitMQ host |

### Node.js Crawler

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://noesis:noesis_dev@localhost:5432/noesis` | Postgres connection string |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672/` | RabbitMQ connection URL |
| `PORT` | `3001` | Listening port |

### Python Embedder

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://noesis:noesis_dev@localhost:5432/noesis` | Postgres connection string |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672/` | RabbitMQ connection URL |
| `EMBEDDING_PROVIDER` | `openai` | `openai` or `ollama` |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Model name |
| `OPENAI_API_KEY` | — | Required when provider is `openai` |
| `OLLAMA_URL` | `http://localhost:11434` | Required when provider is `ollama` |

---

## Copilot CLI MCP Configuration

To use Noesis's MCP tools directly from the **GitHub Copilot CLI**, add the server to
your Copilot MCP configuration.

### Setup

1. Ensure the .NET server is running (`dotnet run` or `docker compose up`).
2. Create or update `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "noesis": {
      "type": "http",
      "url": "http://localhost:5000/mcp",
      "tools": ["*"]
    }
  }
}
```

3. Restart the Copilot CLI (or run `/mcp` to reload). Noesis tools will appear alongside
   the built-in GitHub MCP tools.

### Verify

Use the `/mcp` slash command in the CLI to confirm the server is connected and the tools
(`search_docs`, `get_chunk`, `list_sources`) are listed.

### Alternative: Remote server

Replace `localhost:5000` with your server's hostname/port if running remotely.
No proxy or adapter is needed — the .NET server implements MCP HTTP transport natively.

### Production tip

To restrict which tools Copilot can call autonomously (without asking for approval), list
only read-only tools explicitly:

```json
"tools": ["search_docs", "get_chunk", "list_sources"]
```
