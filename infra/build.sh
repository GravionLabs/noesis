#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
NO_CACHE=false

# The only buildable service in docker-compose.yml is `server`.
# Other services (postgres, seq) use prebuilt images.
SERVICES=(server)

usage() {
  cat <<'USAGE'
Usage: ./infra/build.sh [--no-cache] [--help]

Builds the `server` Docker image from infra/docker-compose.yml.

Options:
  --no-cache    Build images without Docker layer cache
  --help        Show this help text
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --no-cache)
      NO_CACHE=true
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: Unknown argument: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker CLI not found. Install Docker Desktop or Docker Engine first." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose is not available. Install Docker Compose plugin." >&2
  exit 1
fi

BUILD_ARGS=()
if [[ "$NO_CACHE" == "true" ]]; then
  BUILD_ARGS+=(--no-cache)
fi

echo "Building Docker images from $COMPOSE_FILE ..."
echo "Target services: ${SERVICES[*]}"
docker compose -f "$COMPOSE_FILE" build "${BUILD_ARGS[@]}" "${SERVICES[@]}"
echo "Build complete."
