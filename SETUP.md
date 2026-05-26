# Local Development Setup Guide

This guide walks you through running the **entire Noesis stack locally** for the first time to test the Angular documentation import use case.

---

## Recommended: Docker Compose + Local Server

This is the fastest way to get everything running for testing.

### Prerequisites

```bash
# Docker Desktop (macOS/Windows) or Docker Engine (Linux)
docker --version
docker compose version

# .NET 10 SDK
dotnet --version  # Should show 10.x.x

# Node.js + npm (for crawler development, if needed)
node --version && npm --version

# Python 3.12+ with uv (for embedder development, if needed)
python3 --version && uv --version
```

### Step 1: Start Infrastructure (Postgres, RabbitMQ, Migrator, Crawler, Embedder)

```bash
cd infra
docker compose -f docker-compose.yml up -d
```

**Verify all services are running:**
```bash
docker compose -f docker-compose.yml ps
# Should show: postgres, rabbitmq, ef-migrate (exited), crawler, embedder
```

**Check service health:**
```bash
# Postgres
docker compose -f docker-compose.yml logs postgres | grep "database system is ready"

# RabbitMQ
docker compose -f docker-compose.yml logs rabbitmq | grep "Server startup complete"

# Crawler
docker compose -f docker-compose.yml logs crawler | grep "listening on"

# Embedder
docker compose -f docker-compose.yml logs embedder | grep "Application startup complete"
```

### Step 2: Run the .NET Server Locally

```bash
cd server
dotnet run --project src/Gravion.Noesis.Server
```

**Verify server is running:**
```bash
curl http://localhost:5000/health
# Should respond: {"status":"ok"}
```

### Step 3: Test the Import Pipeline

```bash
# 1. Register Angular documentation source
curl -X POST http://localhost:5000/api/sources \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Angular Docs",
    "url": "https://next.angular.dev/assets/context/llms-full.txt",
    "importerType": "llmstxt"
  }' | jq '.id'
# Save the returned ID

# 2. Trigger import
curl -X POST http://localhost:5000/api/sources/{id}/import | jq '.jobId'
# Save the returned jobId

# 3. Poll job status
curl http://localhost:5000/api/jobs/{jobId}
# Watch status progress: pending → running → embedding → done
```

### 4. Run the same import with Ollama embeddings

```bash
# Start Ollama and fetch an embedding model
ollama serve &
ollama pull nomic-embed-text

# Point the embedder at Ollama
export EMBEDDING_PROVIDER=ollama
export EMBEDDING_MODEL=nomic-embed-text
export OLLAMA_URL=http://localhost:11434

# Restart the embedder (or AppHost, if you use it)
```

When using `docker compose`, the embedder container can reach the host Ollama service via `host.docker.internal`.

---

## Alternative: All Services via AppHost

Run **Server + Crawler + Embedder** plus all infrastructure in one command.

### Prerequisites

Same as above, plus:

```bash
# Aspire CLI (optional, for diagnostics dashboard)
dotnet tool install -g Aspire.Hosting.Cli
```

### Start Everything

```bash
cd server/src/Gravion.Noesis.AppHost
dotnet run
```

**Verify all services:**
- Server: http://localhost:5000/health
- Crawler: http://localhost:3001/health
- Embedder: http://localhost:8000/health
- RabbitMQ Management UI: http://localhost:15682/

(Same import test as above applies)

---

## Alternative: Start Services Individually

For development/debugging, run each service in its own terminal.

### Terminal 1: Infrastructure

```bash
cd infra
docker compose -f docker-compose.yml up
# Leave running in foreground to see logs
```

### Terminal 2: .NET Server

```bash
cd server
dotnet run --project src/Gravion.Noesis.Server
```

### Terminal 3: Node.js Crawler (if developing)

```bash
cd crawler
npm install
npm run dev
# Watches for TypeScript changes
```

### Terminal 4: Python Embedder (if developing)

```bash
cd embedder
uv sync
uv run uvicorn noesis_embedder.main:app --reload
# Watches for Python changes
```

---

## Port Reference

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| .NET Server | 5000 | http://localhost:5000 | REST API + MCP endpoint |
| Crawler | 3001 | http://localhost:3001 | Health check |
| Embedder | 8000 | http://localhost:8000 | Embedding API |
| Postgres | 5442 | postgres://noesis:noesis_dev@localhost:5442/noesis | Database |
| RabbitMQ | 5682 | amqp://guest:guest@localhost:5682 | Message broker |
| RabbitMQ Management | 15682 | http://localhost:15682 | Admin dashboard (guest:guest) |

---

## Connection Strings

### Within Docker Containers
```
Postgres (internal): postgres://noesis:noesis_dev@postgres:5432/noesis
RabbitMQ (internal): amqp://guest:guest@rabbitmq:5672/
```

### From Local Host
```
Postgres (external): postgres://noesis:noesis_dev@localhost:5442/noesis
RabbitMQ (external): amqp://guest:guest@localhost:5682/
```

---

## Troubleshooting

### "Postgres container exiting immediately"

**Problem:** `docker compose logs postgres` shows `.../var/lib/postgresql/data` errors

**Solution:** The volume was created for an older Postgres version. Recreate it:
```bash
docker volume rm infra_postgres_data
docker compose -f docker-compose.yml down -v
docker compose -f docker-compose.yml up -d
```

### "Migrator fails: No frameworks found"

**Problem:** Migrator container exits with `.NET 10` not found

**Solution:** Pull fresh images:
```bash
docker pull mcr.microsoft.com/dotnet/aspnet:10.0-alpine
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up -d
```

### "Server can't connect to Postgres"

**Problem:** `SqlException: connection refused`

**Solution:** Verify Postgres is healthy:
```bash
docker compose -f docker-compose.yml exec postgres pg_isready -U noesis
# Should respond: accepting connections
```

If not healthy, check logs:
```bash
docker compose -f docker-compose.yml logs postgres
```

### "Crawler/Embedder consuming but not embedding"

**Problem:** Job stuck in `running` status, no vectors appear

**Solution:** Check RabbitMQ message queues:
```bash
# Open http://localhost:15682 (login: guest:guest)
# Go to Queues tab
# Look for: noesis.start-crawl-job, noesis.crawl-completed, etc.
# Check if messages are accumulating

# Or via logs:
docker compose -f docker-compose.yml logs crawler | tail -50
docker compose -f docker-compose.yml logs embedder | tail -50
```

---

## What Next?

### 1. Index More Sources

After the Angular docs import completes, try other sources:

```bash
# GitHub README
curl -X POST http://localhost:5000/api/sources \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Angular GitHub",
    "url": "https://github.com/angular/angular",
    "importerType": "github"
  }'

# npm package README
curl -X POST http://localhost:5000/api/sources \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "TypeScript npm",
    "url": "https://registry.npmjs.org/typescript",
    "importerType": "npm-readme"
  }'
```

### 2. Test Semantic Search

```bash
curl -s -X POST http://localhost:5000/api/tools/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "how to use dependency injection",
    "limit": 5
  }' | jq '.results'
```

### 3. Configure Embeddings

By default, uses OpenAI `text-embedding-3-small`. To use local Ollama:

```bash
# Start Ollama
ollama serve &
ollama pull nomic-embed-text

# Restart embedder with Ollama provider
export EMBEDDING_PROVIDER=ollama
export OLLAMA_URL=http://localhost:11434
# Then restart embedder service
```

### 4. Use MCP Tools in Copilot CLI

Configure `~/.copilot/mcp-config.json`:

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

Then use in Copilot CLI:
```bash
/mcp  # Verify connection
# Tools will appear in autocomplete
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│ User / IDE (Copilot, VS Code, etc.)                 │
└────────────────────┬────────────────────────────────┘
                     │ MCP tools / REST API
                     ▼
        ┌────────────────────────────┐
        │  .NET Server (localhost:5000)
        │  - Orchestrator            │
        │  - MCP endpoint            │
        │  - REST API                │
        └────────────────────────────┘
             │          │            │
    RabbitMQ │          │            │ RabbitMQ
             ▼          ▼            ▼
    ┌──────────────┐  ┌──────────┐  ┌────────────┐
    │ Crawler      │  │ Database │  │ Embedder   │
    │ (Node.js)    │  │ Postgres │  │ (Python)   │
    │ :3001        │  │ pgvector │  │ :8000      │
    └──────────────┘  │ :5442    │  └────────────┘
                      └──────────┘
          ┌──────────────────────────────┐
          │ RabbitMQ Message Broker      │
          │ :5682                        │
          └──────────────────────────────┘
```

Import pipeline:
1. User: Register source → Server
2. Server: Publish `StartCrawlJob` → RabbitMQ
3. Crawler: Consume, fetch content, store chunks → Postgres
4. Crawler: Publish `CrawlCompleted` → RabbitMQ
5. Server: Consume, publish `StartEmbedJob` → RabbitMQ
6. Embedder: Consume, call OpenAI/Ollama, store vectors → pgvector
7. Embedder: Publish `EmbedCompleted` → RabbitMQ
8. Server: Consume, mark job done

Search pipeline:
1. User: Call `search_docs(query)` via MCP
2. Server: Embed query (call Embedder `/embed/query`)
3. Server: Search pgvector (cosine distance `<=>`)
4. Server: Return chunks with scores

---

## More Information

See:
- [`README.md`](README.md) — Architecture, importers, MCP tools
- [`AGENTS.md`](AGENTS.md) — Full endpoint reference, environment variables
- [`infra/README.md`](infra/README.md) — Kubernetes / Helm deployment
