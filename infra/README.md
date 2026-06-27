# Noesis – Infra

Local infrastructure for development: Postgres with pgvector, Seq, and the Noesis server.

---

## Prerequisites

### Docker

```bash
docker --version
docker compose version
docker info
```

Use Docker Desktop on macOS/Windows or Docker Engine + Compose plugin on Linux.
Ensure the Docker daemon is running before executing `docker compose`.

---

## Quick Start

```bash
# From repo root
docker compose -f infra/docker-compose.yml up -d
```

This starts:
- **Postgres** (with pgvector) — database on port 5442
- **Seq** — central log store on port 5341 (API) / 5380 (UI)
- **Server** — Fastify + MCP + Playwright crawler + embedding on port 5000

### Build images

Only the `server` service has a buildable Docker image. Other services use prebuilt images.

```bash
# Build the server image
./infra/build.sh

# Optional: disable Docker cache
./infra/build.sh --no-cache
```

```powershell
# Build the server image
./infra/build.ps1

# Optional: disable Docker cache
./infra/build.ps1 -NoCache
```

### Stop & clean up

```bash
docker compose -f infra/docker-compose.yml down          # keep volumes
docker compose -f infra/docker-compose.yml down -v       # remove volumes
```

---

## Services & Ports

| Service | Container Port | Host Port | Notes |
|---|---|---|---|
| Postgres | 5432 | **5442** | `noesis` DB, user `noesis` / `noesis_dev` |
| Postgres (test) | 5432 | **5443** | Test DB `noesis_test` (profile: `test`) |
| Seq | 5341, 80 | **5341**, **5380** | Web UI + ingestion: http://localhost:5380 |
| Server | 5000 | **5000** | Fastify server — MCP, REST, crawler, embedding |

---

## Server Environment Variables

The `server` container supports these environment variables:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://noesis:noesis_dev@postgres:5432/noesis` | Postgres connection string |
| `EMBEDDING_PROVIDER` | `local` | `local`, `ollama`, or `openai` |
| `EMBEDDING_MODEL` | `Xenova/bge-base-en-v1.5` | Embedding model name |
| `LOG_SINK` | `stdout` | `stdout`, `seq`, or `ecs` |
| `SEQ_URL` | `http://seq:5341` | Seq ingestion URL (used when `LOG_SINK=seq`) |
| `LOG_LEVEL` | `info` | `trace`, `debug`, `info`, `warn`, `error`, `fatal` |

Additional variables (`GITHUB_TOKEN`, `AZURE_DEVOPS_TOKEN`, `OPENAI_API_KEY`, `OLLAMA_URL`, etc.) can be set to enable specific importers or embedding providers. See [`apps/server/.env.example`](../apps/server/.env.example) for the full list.

---

### GitHub Packages

The `@gravionlabs` npm packages are hosted on GitHub Packages. For installation:

```bash
# Set a GitHub token with read:packages scope
export NODE_AUTH_TOKEN=ghp_...

# Required in CI and for fresh installs
pnpm install
```

The `apps/ui/.npmrc` file configures the registry for `@gravionlabs` scope.

### Seq

If Seq was started once with a broken first-run state, remove the `seq_data` volume before restarting:

```bash
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml up -d
```

Vector is not included in the local compose setup. Seq receives logs directly from the server via the pino-seq transport when `LOG_SINK=seq`.
