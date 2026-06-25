# API Contracts

## Public API

### `GET /healthz/live`
- Liveness probe. Returns `{ status: "alive" }`.

### `GET /healthz/ready`
- Readiness probe. Returns embedding config, scheduler state, and live DB counts.

### `GET /api/sources`
- Returns all sources.

### `POST /api/sources`
- Creates a source.
- Body:
  - `name`
  - `url`
  - `importerType` (default: `llmstxt`)
  - `config?`
  - `schedule?`
- Duplicate URLs are rejected as conflicts.

### `DELETE /api/sources/{id}`
- Deletes a source by ID.

### `POST /api/sources/{id}/import`
- Triggers an import job for the source.
- Returns a job reference.

### `GET /api/jobs`
- Returns recent jobs.

### `GET /api/jobs/{id}`
- Returns a single job or `404` if unknown.

## Internal callbacks

### `POST /api/internal/embed-completed`
- Called by the embedder after finishing vector creation.
- Body:
  - `jobId`
  - `sourceId`
  - `chunkCount`

## Response shapes
- Sources expose `id`, `name`, `url`, `importerType`, `enabled`, `schedule`, `lastImportedAt`.
- Jobs expose `id`, `sourceId`, `type`, `status`, `error`, `startedAt`, `finishedAt`, `createdAt`.
