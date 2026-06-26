# CODEBASE.md — Noesis Server Reference

Detailed technical reference for the `apps/server` workspace. Complements `AGENTS.md` (architecture overview) with the per-file detail needed to implement features without re-scanning the codebase.

---

## DB Access Policy

**Rule:** Use `database.db` (Drizzle ORM) for all DML and DQL. The `database.query()` raw passthrough was removed.

| Pattern | When to use | Example |
|---|---|---|
| `database.db.select().from(t).where(...)` | Simple reads, joins | All service reads |
| `database.db.insert(t).values(...).returning()` | Inserts with result | `createSource`, `createJob` |
| `database.db.update(t).set(...).where(...)` | Updates | `updateSource`, `completeJob` |
| `database.db.delete(t).where(...)` | Deletes | `purgeNoisyChunks` |
| `database.db.transaction(async tx => {...})` | Multi-statement atomicity | `saveChunks` |
| `database.db.execute(sql\`...\`)` | Postgres-specific operators only | FTS, pgvector, correlated subqueries |

**Never** add new raw SQL outside `migrations.ts`. If an ORM equivalent exists, use it. If only Postgres-specific syntax is needed (`to_tsvector`, `<=>`, `ROUND`, `md5`), use the `sql` tagged template via `db.execute()`.

---

## Database Schema

```
sources (root)
│  id, name, url, importer_type, enabled, config, schedule, last_imported_at
│
├── docs.source_id → sources.id         [ON DELETE CASCADE]
│   └── chunks.doc_id → docs.id         [ON DELETE CASCADE]
│       └── embeddings.chunk_id → chunks.id  [ON DELETE CASCADE]
│
├── chunks.source_id → sources.id       [ON DELETE CASCADE]  ← integrity FK, no data path
│
└── jobs.source_id → sources.id         [ON DELETE CASCADE]
```

**All tables auto-clean when a source is deleted** — the entire cascade fires from a single `DELETE FROM sources WHERE id = $1`.

### Table quick-reference

| Table | Key columns | Notes |
|---|---|---|
| `sources` | `id`, `url` (unique), `importer_type`, `schedule`, `enabled` | Root of all cascades |
| `docs` | `id`, `source_id`, `url`, `content_md`, `content_hash` | Unique on `(source_id, url)` |
| `chunks` | `id`, `doc_id`, `source_id`, `content`, `chunk_index`, `token_count` | `source_id` denormalised for fast filtering |
| `embeddings` | `id`, `chunk_id`, `model`, `dimensions`, `vector` | Unique on `(chunk_id, model)`; `vector` is pgvector type |
| `jobs` | `id`, `source_id`, `type`, `status`, `retry_count`, `duration_ms`, `result` | `result` stores JSON `{chunksDropped:[...]}` |

Schema definition: `src/db/schema.ts`  
Migrations (hand-rolled, idempotent): `src/db/migrations.ts`

---

## Service Map

### `src/services/source-service.ts`
**Tables:** sources (owned), docs/chunks/jobs (read-only in `getSourceStats`)  
**DB access:** Drizzle ORM for all CRUD; `db.execute(sql\`...\`)` for `getSourceStats` (single-round-trip correlated subquery)  
**Key methods:**
- `createSource(input)` — deduplicates by URL; returns null on conflict
- `deleteSource(id)` — deletes source row; cascade handles all dependents
- `getSourceStats(sourceId)` — returns `{docCount, chunkCount, avgTokenCount, latestJobStatus, latestJobDurationMs}` in one query
- `getTotalSourceCount()` — used by StatsService

### `src/services/chunk-service.ts`
**Tables:** chunks (owned), docs (upserted in saveChunks), sources (read via JOIN)  
**DB access:** Drizzle ORM for all; `db.transaction()` for saveChunks  
**Key methods:**
- `saveChunks(chunks, sourceId)` — upserts docs + inserts chunks in one transaction; `ON CONFLICT DO NOTHING` for chunks (dedup by unique PK)
- `getChunkWithSource(chunkId)` — 3-way JOIN returning `ChunkWithSource`
- `purgeNoisyChunks(sourceId?)` — applies `isLinkListChunk` predicate; embeddings cascade-deleted

### `src/services/job-service.ts`
**Tables:** jobs (owned)  
**DB access:** Drizzle ORM throughout; `db.execute(sql\`...\`)` for `getAvgImportDuration` (needs `ROUND(AVG(...))::int`)  
**Key methods:**
- `completeJob(id, durationMs, result?)` — accepts optional JSON result string (`chunksDropped`)
- `failJob(id, error, durationMs, retryCount)` — increments retry_count
- `getPendingJobCount()`, `getTotalJobCount()`, `getAvgImportDuration()` — used by StatsService

### `src/services/search-service.ts`
**Tables:** chunks, docs, sources, embeddings (all read-only)  
**DB access:** `db.execute(sql\`...\`)` only — FTS (`to_tsvector`, `ts_rank`, `@@`) and pgvector (`<=>`) have no Drizzle ORM equivalent  
**Key methods:**
- `searchDocs(query, limit, sourceName?)` — tries vector search first, falls back to FTS
- `searchByText(...)` — Postgres FTS with optional source name filter
- `searchByVector(...)` — pgvector cosine similarity; `floatVec` custom type handles `[...]` serialisation

### `src/services/stats-service.ts`
**Tables:** docs, chunks, embeddings (counts); delegates source/job stats to other services  
**DB access:** `db.select({count:count()}).from(table)` for table totals; `db.execute(sql\`...\`)` for `SUM(LENGTH(content))`  
**Dependencies:** `SourceService.getTotalSourceCount()`, `JobService.getTotalJobCount()`, `JobService.getAvgImportDuration()`

### `src/services/import-service.ts`
**Role:** Thin orchestration layer — checks for a running job then calls `jobRunner.runImport()`

### `src/services/embedding-service.ts`
**Role:** Wraps the configured embedding provider; exposes `embedUnembeddedChunks(sourceId?)` which calls `processPendingChunks` from `batch-processor.ts`

---

## Embedding Batch Processor

**File:** `src/embedding/batch-processor.ts`  
**DB access:** Drizzle ORM with `notExists()` for anti-join against embeddings; `onConflictDoNothing()` for idempotent upserts  
**Pattern:**
```
chunks WHERE NOT EXISTS (SELECT 1 FROM embeddings WHERE chunk_id = c.id AND model = ?)
  → embed in batches of 100
  → INSERT INTO embeddings ... ON CONFLICT DO NOTHING
```
The `floatVec` custom type in `schema.ts` serialises `number[]` ↔ `"[1,2,3]"` so no manual `::vector` cast is needed in the ORM path.

---

## Import Pipeline

```
POST /api/sources/:id/import
  → ImportService.triggerImport()
  → JobRunner.runImport(sourceId)
    → JobService.createJob()
    → getImporter(source.importerType)   ← src/importers/registry.ts
    → importer.import(source)
      → fetches + chunks + saves via ChunkService.saveChunks()
      → returns ImportResult { chunkCount, chunksDropped? }
    → EmbeddingService.embedUnembeddedChunks(sourceId)
    → JobService.completeJob(id, durationMs, resultJson)
    → SourceService.updateLastImported(sourceId)
```

**Crawler-based importers** (importer_type = `"crawler"`) go through a different path:
```
  → POST http://crawler:3001/jobs/crawl   (Node.js Playwright crawler)
  → crawler writes chunks directly to Postgres
  → server polls for completion
  → proceeds to embed step
```

---

## Scheduler

**File:** `src/pipeline/scheduler.ts`  
In-memory `Map<sourceId, cron.ScheduledTask>`. Fires `JobRunner.runImport(sourceId)` on the cron schedule.

**Key methods:**
- `scheduleNextRun(source)` — upserts a cron task; stops existing task if rescheduling
- `unschedule(sourceId)` — called by DELETE /api/sources/:id to prevent stale task firing
- `refreshSchedules()` — syncs from DB; called every 60s by `startScheduler()`

---

## Route → Service Dependency Map

| Route file | Services used |
|---|---|
| `routes/sources.ts` | `SourceService`, `ImportService`, `Scheduler`, `ChunkService` |
| `routes/jobs.ts` | `JobService` |
| `routes/search.ts` | `SearchService` |
| `routes/stats.ts` | `StatsService` |
| `routes/healthz.ts` | `Database` (db.execute), `EmbeddingService` |
| `routes/internal.ts` | `ChunkService`, `EmbeddingService` (crawler callback) |

Routes contain **zero direct DB calls** — all DB access goes through services.

---

## Test Conventions

**Location:** `apps/server/test/` mirrors `apps/server/src/`

**Service tests** — inject mock `database.db` objects:
```ts
// Simple pattern: configure terminal mock return value
mockDb._selectResult = [row1, row2];
mockDb._returningResult = [{ id: "doc-1" }];
// See test/services/chunk-service.test.ts for the full chainable mock setup
```

**Route tests** — use `Fastify` with injected service mocks via `registerXRoutes(app, { ...mockServices })`.

**Running tests:** `pnpm --filter server test`  
**Build check:** `pnpm --filter server build`

---

## Noise Filtering (epic #261)

**Core predicate:** `isLinkListChunk(content)` in `src/importers/chunk-utils.ts`  
Drops chunks where >70% of non-empty, non-fenced-code lines are markdown list-links.

**Applied at:** ingestion time (all importers) + retroactively via `POST /api/sources/:id/backfill`

**Crawler-only noise:** `stripCrawlerNoise()` in `src/crawler/crawler.ts` strips pagination lines and breadcrumb chains before chunking. Not applied to non-crawler importers.

**Observability:** `ImportResult.chunksDropped?: { reason, count }[]` threaded through all importers → stored in `jobs.result` as JSON → exposed via `GET /api/jobs/:id`.
