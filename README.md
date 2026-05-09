# Contexteur

Self-hosted documentation context engine — crawl, embed, and query your docs via MCP.
Index any documentation source into Postgres + pgvector and expose it as MCP tools
for use in GitHub Copilot CLI, VS Code, and any MCP-compatible client.

**Stack:** .NET 10 · Node.js/TypeScript · Python (uv) · Postgres + pgvector · RabbitMQ

---

## Architecture

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
    Server <-- "POST /api/internal/crawl-completed" --- Crawler
    Server <-- "POST /api/internal/embed-completed" --- Embedder

    Server -- "read/write" --> DB
    Crawler -- "write chunks" --> DB
    Embedder -- "write vectors" --> DB

    Server -- "Wolverine Saga" --> RabbitMQ
```

```
contexteur/
├── server/    .NET 10 — MCP server, REST API, import orchestration (Wolverine Saga)
├── crawler/   Node.js/TypeScript — Playwright crawler + llms-full.txt ingest
├── embedder/  Python (uv) — embedding pipeline (OpenAI, Ollama)
└── infra/     Docker Compose (Podman-compatible) + Helm chart
```

---

## Quick Start

### Prerequisites

- Podman (or Docker) + Compose
- .NET 10 SDK
- Node.js 20+
- Python 3.12+ with [uv](https://docs.astral.sh/uv/)

### 1 — Start the dev stack

```bash
# Linux with Podman: enable socket once
sudo systemctl enable --now podman.socket

docker compose -f infra/docker-compose.yml up -d
```

See [`infra/README.md`](infra/README.md) for port reference and connection strings.

### 2 — Run the server

```bash
cd server && dotnet run --project src/Gravion.Contexteur.Server
```

### 3 — Run the crawler

```bash
cd crawler && npm install && npm run dev
```

### 4 — Run the embedder

```bash
cd embedder && uv sync && uv run uvicorn main:app --reload
```

---

## Importers

Register a source with `POST /api/sources` using one of these `importerType` values:

| Type | Description | Example URL |
|---|---|---|
| `llmstxt` | Fetches `llms-full.txt`, chunks by heading | `https://next.angular.dev/assets/context/llms-full.txt` |
| `llmstxt-meta` | Fetches `llms.txt`, extracts metadata | `https://next.angular.dev/llms.txt` |
| `llmstxt-crawl` | Fetches `llms.txt`, crawls each linked page via Playwright | `https://next.angular.dev/llms.txt` |
| `crawler` | Playwright full-page crawl | `https://angular.dev/guide` |
| `github` | GitHub repository README | `https://github.com/angular/angular` |
| `azuredevops` | Azure DevOps wiki / repo | `https://dev.azure.com/org/project` |
| `npm-readme` | npm package README from registry API | `https://registry.npmjs.org/lodash` |
| `openapi` | OpenAPI JSON spec — one chunk per operation | `https://api.example.com/openapi.json` |

### Example: index Angular docs

```bash
# 1. Register source
curl -X POST http://localhost:5000/api/sources \
  -H 'Content-Type: application/json' \
  -d '{"name":"Angular","url":"https://next.angular.dev/assets/context/llms-full.txt","importerType":"llmstxt"}'

# 2. Trigger import (returns jobId)
curl -X POST http://localhost:5000/api/sources/<id>/import

# 3. Poll status
curl http://localhost:5000/api/jobs/<jobId>
# pending → running → embedding → done
```

---

## MCP Tools

| Tool | Description | Parameters |
|---|---|---|
| `search_docs` | Semantic similarity search over all indexed chunks | `query`, `limit?`, `source?` |
| `get_chunk` | Retrieve a specific chunk by UUID | `chunkId` |
| `list_sources` | List all registered sources | — |

All tools are **read-only** and **idempotent**.

### Use with GitHub Copilot CLI

1. Start the server (`dotnet run` or `docker compose up`)
2. Create `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "contexteur": {
      "type": "http",
      "url": "http://localhost:5000/mcp",
      "tools": ["search_docs", "get_chunk", "list_sources"]
    }
  }
}
```

3. Run `/mcp` in the Copilot CLI to verify the connection.

---

## Further Reading

| Document | Description |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Full architecture, all endpoints, environment variables, pipeline flow |
| [`infra/README.md`](infra/README.md) | Port reference, connection strings, Podman setup |
| [`ROADMAP.md`](ROADMAP.md) | Planned features, migration strategies, import source roadmap |
