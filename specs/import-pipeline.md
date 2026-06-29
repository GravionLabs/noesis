# Import Pipeline

Describes how Noesis imports documentation from a source into Postgres.

---

## Overview

The import pipeline is synchronous and in-process — there are no message queues, separate workers, or external crawl services. Everything runs inside the single TypeScript (Fastify) server process.

```
POST /api/sources/:id/import
  │
  ▼
ImportService.triggerImport()
  │  creates job row (status: pending)
  │  calls JobRunner.runImport() asynchronously
  │
  ▼
JobRunner.executeImport()
  │  job → running
  │  selects Importer from ImporterRegistry by source.importerType
  │
  ▼
Importer.import(source, abortSignal, onLog)
  │  fetches content, chunks it, saves chunks to Postgres
  │  (crawler importers use embedded Playwright — no HTTP call to a separate service)
  │
  ▼
EmbeddingService.embedUnembeddedChunks()
  │  generates vectors for new chunks
  │  writes to pgvector
  │
  ▼
job → done  (or failed / cancelled)
source.lastImportedAt updated
```

---

## Job States

```
pending → running → done
                 → failed   (auto-retried up to MAX_IMPORT_RETRIES times with exponential backoff)
                 → cancelled (user-initiated via POST /api/jobs/:id/cancel)
```

The job row is created with `status: pending` immediately when the import is triggered, before the runner starts executing. This lets the UI show the job at once.

---

## Importer Types

| Type | Description |
|---|---|
| `llmstxt` | Fetches `llms-full.txt`, splits on headings |
| `llmstxt-meta` | Fetches `llms.txt`, extracts linked page metadata |
| `llmstxt-crawl` | Fetches `llms.txt`, then crawls each linked page with Playwright |
| `crawler` | Playwright-based recursive docs crawl |
| `github` | Fetches a GitHub repository README via the GitHub API |
| `npm-readme` | Fetches a package README from the npm registry |
| `openapi` | Parses an OpenAPI JSON/YAML spec into operation chunks |
| `azuredevops` | Fetches an Azure DevOps wiki or repo README |

Each importer implements:
```ts
interface Importer {
  readonly type: string;
  import(source: Source, signal?: AbortSignal, onLog?: (msg: string, level?: string) => void): Promise<ImportResult>;
}
```

---

## Retry Behaviour

On failure the job is marked `failed` and re-queued with exponential backoff:

```
attempt 1 → wait  10s
attempt 2 → wait  20s
attempt 3 → wait  40s (capped at 120s)
```

The maximum number of retry attempts is controlled by `MAX_IMPORT_RETRIES` (default `3`). After the final attempt the job stays `failed` and is not retried automatically. A manual retry is available via `POST /api/jobs/:id/retry`.

---

## Cancellation

A running job can be cancelled via `POST /api/jobs/:id/cancel`. The route aborts the in-flight `AbortController` associated with the job. Importers that receive the signal stop at their next checkpoint; crawl-based importers drain in-flight page requests before returning.

---

## Incremental Imports

Importers that support incremental mode (e.g. `crawler`, `llmstxt-crawl`) hash each document's content on fetch and compare against stored hashes. Unchanged documents are skipped, reducing both crawl time and embedding cost.

---

## Scheduling

Sources with a `schedule` field (cron expression) are re-imported automatically by the in-process `Scheduler`. The scheduler runs on the leader instance only (single-node deployments are always the leader).
