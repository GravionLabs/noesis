# Contexteur – Infra

Local infrastructure for development: Postgres with pgvector, RabbitMQ, and the EF Core migrator.

---

## Prerequisites

### Podman (Linux)

The `docker` CLI on this machine is a Podman emulator. Before running `docker compose`,
the system-level Podman socket must be active:

```bash
sudo systemctl enable --now podman.socket
```

This only needs to be done once. Verify with:

```bash
docker info   # should show Podman info, no error
```

**Alternative (rootless, per session):**

```bash
systemctl --user enable --now podman.socket
export DOCKER_HOST="unix:///run/user/$(id -u)/podman/podman.sock"
```

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
| Postgres | 5432 | **5442** | `contexteur` DB, user `contexteur` / `contexteur_dev` |
| RabbitMQ AMQP | 5672 | **5682** | Used by Wolverine |
| RabbitMQ Management | 15672 | **15682** | Web UI: http://localhost:15682 (guest/guest) |

---

## Connection Strings

### .NET Server (`appsettings.Development.json`)

```json
{
  "ConnectionStrings": {
    "contexteur": "Host=localhost;Port=5442;Database=contexteur;Username=contexteur;Password=contexteur_dev"
  }
}
```

### Node.js Crawler (`.env`)

```env
DATABASE_URL=postgres://contexteur:contexteur_dev@localhost:5442/contexteur
```

### Python Embedder (`.env`)

```env
DATABASE_URL=postgres://contexteur:contexteur_dev@localhost:5442/contexteur
```
