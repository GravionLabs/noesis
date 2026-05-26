#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:5000}"
SOURCE_NAME="${SOURCE_NAME:-Angular}"
SOURCE_URL="${SOURCE_URL:-https://next.angular.dev/assets/context/llms-full.txt}"
IMPORTER_TYPE="llmstxt"
POLL_INTERVAL_SECONDS="${POLL_INTERVAL_SECONDS:-2}"
POLL_TIMEOUT_SECONDS="${POLL_TIMEOUT_SECONDS:-1800}"
ENSURE_MIGRATIONS=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/infra/docker-compose.yml"

usage() {
  cat <<'USAGE'
Usage: ./scripts/import-angular-llms-full.sh [--ensure-migrations] [--help]

Options:
  --ensure-migrations  Builds and runs the ef-migrate workflow before importing.
  --help               Show this help message.

Configurable environment variables:
  API_BASE_URL           (default: http://localhost:5000)
  SOURCE_NAME            (default: Angular)
  SOURCE_URL             (default: https://next.angular.dev/assets/context/llms-full.txt)
  POLL_INTERVAL_SECONDS  (default: 2)
  POLL_TIMEOUT_SECONDS   (default: 1800)
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --ensure-migrations)
      ENSURE_MIGRATIONS=true
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

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is not installed." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: Neither jq nor python3 found. Please install at least one." >&2
  exit 1
fi

API_BODY=""

ensure_migrations() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: docker is not installed, --ensure-migrations cannot be used." >&2
    exit 1
  fi

  if ! docker compose version >/dev/null 2>&1; then
    echo "ERROR: docker compose is not available, --ensure-migrations cannot be used." >&2
    exit 1
  fi

  if [[ ! -f "$COMPOSE_FILE" ]]; then
    echo "ERROR: Compose file not found: $COMPOSE_FILE" >&2
    exit 1
  fi

  echo "Running optional DB migrations (ef-migrate) ..."
  docker compose -f "$COMPOSE_FILE" build ef-migrate
  docker compose -f "$COMPOSE_FILE" up -d postgres
  docker compose -f "$COMPOSE_FILE" run --rm ef-migrate --migrate
}

api_call() {
  local method="$1"
  local url="$2"
  local data="${3:-}"
  local response
  local http_code
  local body

  if [[ -n "$data" ]]; then
    response="$(curl -sS -X "$method" "$url" -H "Content-Type: application/json" --data "$data" -w $'\n%{http_code}')"
  else
    response="$(curl -sS -X "$method" "$url" -w $'\n%{http_code}')"
  fi

  http_code="${response##*$'\n'}"
  body="${response%$'\n'*}"

  if [[ "$http_code" -lt 200 || "$http_code" -ge 300 ]]; then
    echo "ERROR: $method $url failed (HTTP $http_code)." >&2
    if [[ -n "$body" ]]; then
      echo "Response: $body" >&2
    fi
    exit 1
  fi

  API_BODY="$body"
}

json_field() {
  local json="$1"
  local field="$2"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$json" | jq -r --arg field "$field" '.[$field] // empty'
  else
    printf '%s' "$json" | python3 - "$field" <<'PY'
import json
import sys

field = sys.argv[1]
payload = json.load(sys.stdin)
value = payload.get(field, "")
if value is None:
    value = ""
print(value)
PY
  fi
}

find_source_id() {
  local json="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$json" | jq -r --arg url "$SOURCE_URL" --arg importer "$IMPORTER_TYPE" '.[] | select(.url == $url and .importerType == $importer) | .id' | head -n1
  else
    printf '%s' "$json" | python3 - "$SOURCE_URL" "$IMPORTER_TYPE" <<'PY'
import json
import sys

url = sys.argv[1]
importer = sys.argv[2]
payload = json.load(sys.stdin)
for source in payload:
    if source.get("url") == url and source.get("importerType") == importer:
        print(source.get("id", ""))
        break
PY
  fi
}

echo "Checking server: $API_BASE_URL/health"
api_call GET "$API_BASE_URL/health"

if [[ "$ENSURE_MIGRATIONS" == "true" ]]; then
  ensure_migrations
fi

echo "Looking for existing Angular source ..."
api_call GET "$API_BASE_URL/api/sources"
source_id="$(find_source_id "$API_BODY")"

if [[ -z "$source_id" ]]; then
  echo "Source not found. Creating new source ..."
  create_payload="$(cat <<JSON
{"name":"$SOURCE_NAME","url":"$SOURCE_URL","importerType":"$IMPORTER_TYPE"}
JSON
)"
  api_call POST "$API_BASE_URL/api/sources" "$create_payload"
  source_id="$(json_field "$API_BODY" "id")"

  if [[ -z "$source_id" ]]; then
    echo "ERROR: Could not read source ID from response." >&2
    exit 1
  fi
else
  echo "Existing source found: $source_id"
fi

echo "Triggering import for source $source_id ..."
api_call POST "$API_BASE_URL/api/sources/$source_id/import"
job_id="$(json_field "$API_BODY" "jobId")"

if [[ -z "$job_id" ]]; then
  echo "ERROR: Could not read job ID from response." >&2
  exit 1
fi

echo "Import started. Job ID: $job_id"
echo "Waiting for completion (timeout: ${POLL_TIMEOUT_SECONDS}s, interval: ${POLL_INTERVAL_SECONDS}s) ..."

start_epoch="$(date +%s)"
while true; do
  api_call GET "$API_BASE_URL/api/jobs/$job_id"
  status="$(json_field "$API_BODY" "status")"
  error_msg="$(json_field "$API_BODY" "error")"

  case "$status" in
    done)
      echo "Import completed successfully (status: done)."
      break
      ;;
    failed|error)
      echo "ERROR: Import failed (status: $status)." >&2
      [[ -n "$error_msg" ]] && echo "Error: $error_msg" >&2
      exit 1
      ;;
    pending|running|embedding)
      echo "Current status: $status"
      ;;
    *)
      echo "WARN: Unexpected job status: $status"
      ;;
  esac

  now_epoch="$(date +%s)"
  if (( now_epoch - start_epoch >= POLL_TIMEOUT_SECONDS )); then
    echo "ERROR: Timeout reached, last status: $status (jobId: $job_id)." >&2
    exit 1
  fi

  sleep "$POLL_INTERVAL_SECONDS"
done

echo "Done. Source ID: $source_id | Job ID: $job_id"
