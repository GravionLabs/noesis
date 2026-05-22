#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker CLI not found. Install Docker Desktop or Docker Engine first." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose is not available. Install Docker Compose plugin." >&2
  exit 1
fi

BUILD_ARGS=()
if [[ "${1:-}" == "--no-cache" ]]; then
  BUILD_ARGS+=(--no-cache)
fi

echo "Building Docker images from $COMPOSE_FILE ..."
docker compose -f "$COMPOSE_FILE" build "${BUILD_ARGS[@]}" ef-migrate crawler embedder
echo "Build complete."
