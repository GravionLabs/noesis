# Noesis – Infra

Local infrastructure for development: Postgres with pgvector, RabbitMQ, and the EF Core migrator.

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
- **ef-migrate** — runs EF Core migrations then exits

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
