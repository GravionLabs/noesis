# Noesis – Infra

Local infrastructure for development: Postgres with pgvector, RabbitMQ, Seq, Vector, crawler, embedder, EF Core migrator, and MCP Inspector.

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
- **Postgres** (with pgvector) — waits for healthy before migrator runs
- **RabbitMQ** — with management UI
- **Seq** — central log store for all container stdout/stderr
- **Vector** — Docker log collector that forwards container logs to Seq
- **ef-migrate** — runs EF Core migrations then exits
- **crawler** — Playwright-based crawler service
- **embedder** — embedding service
- **mcp-inspector** — web UI for testing MCP endpoints

### Build images

```bash
# Default: rebuild only ef-migrate
./infra/build.sh

# Rebuild all app images (ef-migrate, crawler, embedder)
./infra/build.sh --all

# Optional: disable Docker cache
./infra/build.sh --all --no-cache
```

```powershell
# Default: rebuild only ef-migrate
./infra/build.ps1

# Rebuild all app images
./infra/build.ps1 -All

# Optional: disable Docker cache
./infra/build.ps1 -All -NoCache
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
| RabbitMQ AMQP | 5672 | **5682** | Used by Wolverine |
| RabbitMQ Management | 15672 | **15682** | Web UI: http://localhost:15682 (guest/guest) |
| Seq | 80 | **5341** | Web UI + ingestion: http://localhost:5341 (`admin` / `seq-dev-password`, API key `seq-dev-api-key`) |
| Crawler | 3001 | **3001** | Node.js crawler API |
| Embedder | 8000 | **8000** | Python embedder API |
| UI (Angular) | 80 | **4200** | Built Angular app served via nginx |
| MCP Inspector (UI) | 6274 | **6274** | UI: http://localhost:6274 |
| MCP Inspector (Proxy) | 6277 | **6277** | Internal proxy/API used by the UI |

---

## MCP Inspector

After `docker compose -f infra/docker-compose.yml up -d`, open:

`http://localhost:6274`

The Inspector service is preconfigured to connect via HTTP transport to:

`http://host.docker.internal:5000/mcp`

> `localhost` inside the `mcp-inspector` container points to the container itself, not your host machine.  
> Use `host.docker.internal` to reach a locally running Noesis server.

Override the target MCP endpoint when starting compose:

```bash
MCP_SERVER_URL=http://host.docker.internal:5000/mcp docker compose -f infra/docker-compose.yml up -d
```

> The compose setup currently disables Inspector auth (`DANGEROUSLY_OMIT_AUTH=true`) for local development convenience.
> The current Inspector image uses Node 22 because `@modelcontextprotocol/inspector@0.21.2` requires Node `>=22.7.5`.
> For **Direct + HTTP** in Inspector, the Noesis server must allow the UI origin via CORS (default: `http://localhost:6274`, `http://127.0.0.1:6274` in `server/src/Gravion.Noesis.Server/appsettings.json` under `Mcp:InspectorAllowedOrigins`).

---

## Connection Strings

### .NET Server (`appsettings.Development.json`)

```json
{
  "ConnectionStrings": {
    "noesis": "Host=localhost;Port=5442;Database=noesis;Username=noesis;Password=noesis_dev"
  }
}
```

### Node.js Crawler (`.env`)

```env
DATABASE_URL=postgres://noesis:noesis_dev@localhost:5442/noesis
```

### Python Embedder (`.env`)

```env
DATABASE_URL=postgres://noesis:noesis_dev@localhost:5442/noesis
```

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

Vector forwards logs to Seq at `http://seq:80/api/events/raw` with the `X-Seq-ApiKey: seq-dev-api-key` header.
