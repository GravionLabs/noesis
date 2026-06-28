# API Contracts

## Health

### `GET /healthz/live`
Liveness probe.

**Response `200`**
```json
{ "status": "alive" }
```

### `GET /healthz/ready`
Readiness probe. Returns `503` when any dependency is unreachable.

**Response `200 / 503`**
```json
{
  "status": "ok",
  "provider": "local",
  "model": "Xenova/bge-base-en-v1.5",
  "dimensions": 768,
  "schedulerRunning": true,
  "schedulerLeader": true,
  "pendingJobs": 0,
  "totalSources": 12
}
```
When degraded, `status` is `"degraded"` and failing checks appear as extra fields, e.g. `"db": "unreachable"`.

---

## Sources

### `GET /api/sources`
List all registered sources.

**Response `200`** — array of Source objects.

### `POST /api/sources`
Create a source.

**Body**
```json
{
  "name": "Angular Docs",
  "url": "https://angular.dev/llms.txt",
  "importerType": "llmstxt",
  "config": null,
  "schedule": "0 3 * * *"
}
```
`importerType` defaults to `"llmstxt"`. `config` and `schedule` are optional.

**Response `201`** — Source object.
**Response `400`** — validation failure.
**Response `409`** — URL already exists.

### `GET /api/sources/:id`
Get a single source.

**Response `200`** — Source object.
**Response `404`** — not found.

### `PATCH /api/sources/:id`
Partial update of a source. All fields are optional.

**Body (all fields optional)**
```json
{
  "name": "Angular Docs v2",
  "url": "https://angular.dev/llms-full.txt",
  "importerType": "llmstxt",
  "enabled": true,
  "config": null,
  "schedule": null
}
```

**Response `200`** — updated Source object.
**Response `400`** — validation failure.
**Response `404`** — not found.

### `DELETE /api/sources/:id`
Delete a source and all its documents, chunks, and embeddings (cascade).

**Response `204`** — deleted.
**Response `404`** — not found.

### `GET /api/sources/:id/stats`
Per-source import statistics.

**Response `200`**
```json
{
  "docCount": 142,
  "chunkCount": 3847,
  "avgTokenCount": 210,
  "latestJobStatus": "done",
  "latestJobDurationMs": 45320
}
```
**Response `404`** — not found.

### `POST /api/sources/:id/import`
Trigger an import job for the source.

**Response `202`**
```json
{ "jobId": "<uuid>", "status": "accepted" }
```
**Response `404`** — source not found.

### `POST /api/sources/:id/backfill`
Purge noisy link-list chunks for the source (idempotent).

**Response `200`**
```json
{ "purged": 17 }
```
**Response `404`** — not found.

---

## Jobs

### `GET /api/jobs`
List recent jobs (most recent 50).

**Response `200`** — array of Job objects.

### `GET /api/jobs/:id`
Get a single job, including parsed `chunksDropped` from the result JSON.

**Response `200`** — Job object (see Response Shapes below).
**Response `404`** — not found.

### `GET /api/jobs/:id/logs`
Get the log entries for a job in chronological order (up to 200 entries).

**Response `200`**
```json
[
  { "id": "<uuid>", "jobId": "<uuid>", "message": "Starting import with type: llmstxt", "level": "info", "createdAt": "2025-01-01T00:00:00.000Z" }
]
```
**Response `404`** — job not found.

### `GET /api/jobs/stream`
Server-Sent Events stream for real-time job status and log updates.

Emits two event types:
- `event: job` — job status change (`{ id, sourceId, status, durationMs?, error? }`)
- `event: log` — log entry (`{ id, jobId, message, level, createdAt }`)

A `:ping` comment is sent every 15 seconds as a heartbeat.

### `POST /api/jobs/:id/cancel`
Cancel a running job.

**Response `202`**
```json
{ "jobId": "<uuid>", "status": "cancelled" }
```
**Response `400`** — job is not running.
**Response `404`** — not found.

### `DELETE /api/jobs/:id`
Delete a job record. The job must not be running (cancel it first).

**Response `204`** — deleted.
**Response `400`** — job is currently running.
**Response `404`** — not found.

### `POST /api/jobs/:id/retry`
Trigger a new import for the source of a failed job.

**Response `202`**
```json
{ "jobId": "<uuid>", "status": "accepted" }
```
**Response `400`** — job is not failed, or has no source reference.
**Response `404`** — not found.

---

## Search

### `GET /api/search`
Semantic + keyword search across indexed chunks.

**Query parameters**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | required | Search query |
| `source` | string | — | Filter to a specific source ID |
| `limit` | int | `10` | Result count (max `50`) |

**Response `200`**
```json
[
  {
    "chunkId": "<uuid>",
    "sourceName": "Angular Docs",
    "docTitle": "Dependency Injection",
    "docUrl": "https://angular.dev/guide/di",
    "heading": "Providing a dependency",
    "content": "...",
    "score": 0.87
  }
]
```
**Response `400`** — missing `q`, or `limit` exceeds 50.

---

## Stats

### `GET /api/stats`
Platform-wide aggregate statistics.

**Response `200`**
```json
{
  "totalSources": 12,
  "totalDocs": 1430,
  "totalChunks": 38470,
  "totalEmbeddings": 38432,
  "totalJobs": 74,
  "avgImportDurationMs": 42180,
  "storageBytes": 8093124
}
```

---

## Internal

### `POST /api/internal/embed-completed`
Called internally when an embedding pass completes (not a public endpoint).

**Body**
```json
{ "jobId": "<uuid>", "sourceId": "<uuid>", "chunkCount": 142 }
```

---

## Response Shapes

### Source object
```json
{
  "id": "<uuid>",
  "name": "Angular Docs",
  "url": "https://angular.dev/llms.txt",
  "importerType": "llmstxt",
  "enabled": true,
  "config": null,
  "schedule": "0 3 * * *",
  "lastImportedAt": "2025-01-01T03:00:00.000Z"
}
```

### Job object
```json
{
  "id": "<uuid>",
  "sourceId": "<uuid>",
  "type": "import",
  "status": "done",
  "error": null,
  "retryCount": 0,
  "maxRetries": 3,
  "durationMs": 45320,
  "chunksDropped": [{ "reason": "too_short", "count": 3 }],
  "startedAt": "2025-01-01T00:00:00.000Z",
  "finishedAt": "2025-01-01T00:00:45.000Z",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

Job `status` values: `pending` → `running` → `done` | `failed` | `cancelled`
