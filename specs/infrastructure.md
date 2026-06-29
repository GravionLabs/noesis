# Infrastructure

Describes the runtime components and deployment layout for Noesis.

---

## Runtime Components

| Component | Technology | Role |
|---|---|---|
| **Server** | TypeScript / Fastify | MCP server, REST API, import pipeline, embedded Playwright crawler, embedding |
| **Angular UI** | Angular 21 + nginx | Web interface for managing sources, jobs, and searching docs |
| **Postgres + pgvector** | PostgreSQL 18 | Primary data store — sources, docs, chunks, embeddings, jobs |
| **Seq** | Datalust Seq | Centralised log sink (optional; `stdout` is the default) |

There is no message broker, no separate crawler process, and no Python embedder. Everything runs inside the single Node.js server process or as a static file served by nginx.

---

## Monorepo Layout

```
noesis/
├── apps/server/    TypeScript server — MCP, REST API, pipeline, crawler, embedding
├── apps/ui/        Angular web UI
└── infra/          Docker Compose, build scripts
```

---

## Docker Compose

`infra/docker-compose.yml` starts all services for local use:

```bash
docker compose -f infra/docker-compose.yml up -d
```

### Services & Ports

| Service | Host Port | Description |
|---|---|---|
| `postgres` | **5442** | Postgres + pgvector (primary DB) |
| `postgres-test` | **5443** | Test DB — only started with `--profile test` |
| `seq` | **5341** (API), **5380** (UI) | Log ingestion and viewer |
| `server` | **5000** | Fastify server — MCP, REST API, crawler, embedding |

The Angular UI is served by the Fastify server on port `5000` when `SERVE_UI=true` (the default). In production, the built Angular app is embedded in the server Docker image.

---

## Server Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Server port |
| `DATABASE_URL` | `postgres://noesis:noesis_dev@localhost:5442/noesis` | Postgres connection string |
| `EMBEDDING_PROVIDER` | `local` | `local`, `ollama`, or `openai` |
| `EMBEDDING_MODEL` | `Xenova/bge-base-en-v1.5` | Embedding model name |
| `EMBEDDING_DIMENSIONS` | `768` | Vector dimensions |
| `API_KEY` | — | Shared secret for `x-api-key` auth (unauthenticated if empty) |
| `SERVER_URL` | `http://localhost:5000` | Public base URL |
| `LOG_LEVEL` | `info` | `trace` / `debug` / `info` / `warn` / `error` / `fatal` |
| `LOG_SINK` | `stdout` | `stdout`, `seq`, or `ecs` |
| `SEQ_URL` | `http://seq:5341` | Seq ingestion URL (when `LOG_SINK=seq`) |
| `SERVE_UI` | `true` | Serve the built Angular UI from the server |
| `MAX_IMPORT_RETRIES` | `3` | Max retry attempts for failed imports |
| `GITHUB_TOKEN` | — | Required for the `github` importer |
| `AZURE_DEVOPS_TOKEN` / `AZURE_DEVOPS_ORG` | — | Required for the `azuredevops` importer |
| `OPENAI_API_KEY` | — | Required when `EMBEDDING_PROVIDER=openai` |
| `OLLAMA_URL` | `http://localhost:11434` | Required when `EMBEDDING_PROVIDER=ollama` |

See `apps/server/.env.example` for the full list.

---

## Build

The server Docker image is a multi-stage build that includes the pre-built Angular UI:

```bash
./infra/build.sh          # Linux / macOS
./infra/build.ps1         # Windows
```

The Angular UI is built with `pnpm --filter ui build` and copied into the server image, then served as static files by Fastify when `SERVE_UI=true`.
