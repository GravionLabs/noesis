#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Starting test database..."
docker compose -f "$REPO_DIR/infra/docker-compose.yml" up -d postgres
docker compose -f "$REPO_DIR/infra/docker-compose.yml" wait postgres

echo "==> Running database migrations..."
cd "$REPO_DIR"
pnpm db:migrate

echo "==> Running tests..."
pnpm test
