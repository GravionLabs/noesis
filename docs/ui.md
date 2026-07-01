# Angular UI

The Noesis web UI is an Angular 21 standalone application in `apps/ui/`. It provides a browser-based interface for managing documentation sources, monitoring import jobs, running semantic searches, and configuring the server connection.

**Tech stack:** Angular 21 · `@gravionlabs/helix` · PrimeNG (Dialogs, Toast, Toolbar) · ag-grid Community (data grids) · Tailwind CSS · NgRx Signals

---

## Setup

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- A GitHub Personal Access Token with `read:packages` scope (to install `@gravionlabs/helix` from GitHub Packages)

```bash
export NODE_AUTH_TOKEN=ghp_...   # GitHub token
```

The `apps/ui/.npmrc` file configures `@gravionlabs:registry=https://npm.pkg.github.com` automatically; no manual npm registry changes are needed.

---

## Quick Start

```bash
# From repo root — install all workspace dependencies
pnpm install

# Start the dev server (port 4200, proxies /api/* and /mcp/* to localhost:5000)
pnpm --filter ui dev
```

The dev proxy (`apps/ui/proxy.conf.json`) forwards `/api/*`, `/mcp/*`, and `/healthz/*` to the Fastify server on `http://localhost:5000`. Start the server first:

```bash
# In a separate terminal
pnpm --filter server dev
# or
docker compose -f infra/docker-compose.yml up -d
```

Open `http://localhost:4200`.

---

## Authentication

The UI reads an API key from `localStorage` and sends it as the `x-api-key` header on every API request via an Angular HTTP interceptor (`apps/ui/src/app/core/interceptors/api-key.interceptor.ts`).

Configure the key on the **Settings** page (`/settings`) or via `localStorage`:
```js
localStorage.setItem('apiKey', 'your-key-here');
```

When `API_KEY` is not set on the server the API is unauthenticated and the key field can be left blank.

---

## Pages

### Dashboard (`/`)
- Platform-wide stats: total sources, docs, chunks, embeddings, jobs
- Recent jobs list with live status badges
- Import duration chart

### Sources (`/sources`)
- List all registered sources with status and last-imported timestamp
- **Create** — form dialog: name, URL, importer type, optional schedule (cron), optional JSON config
- **Detail** (`/sources/:id`) — per-source stats (doc count, chunk count, avg token count), import history, edit form, trigger import, delete

### Jobs (`/jobs`)
- Filterable list (All / Pending / Running / Done / Failed / Cancelled) with live duration for running jobs
- **Cancel** button for running jobs
- **Retry** button for failed jobs
- **Detail** (`/jobs/:id`) — full job metadata, real-time log output, cancel / retry / delete actions

### Browse (`/browse`)
- Browse indexed documents and chunks by source
- Full chunk text viewer

### Query (`/query`)
- Semantic search across all indexed sources or filtered to one source
- Result cards show heading path, chunk preview, source, and relevance score
- Copy chunk text, open full chunk dialog

### Settings (`/settings`)
- **API Key** — stored in `localStorage`, applied to all requests
- **Server URL** — override when the UI is hosted separately from the API
- **Theme** — light, dark, or follow system
- **Server health** — live `GET /healthz/ready` output

---

## Architecture

### Service layer

`NoesisApiService` (`apps/ui/src/app/core/services/noesis-api.service.ts`) wraps every REST endpoint as a typed Angular `HttpClient` method. All components inject this service — there are no direct `fetch` calls in the UI.

### Stores (NgRx Signals)

| Store | Location | Responsibility |
|---|---|---|
| `SourcesStore` | `core/stores/sources.store.ts` | Source list, SSE job updates mapped to source status |
| `JobsStore` | `core/stores/jobs.store.ts` | Job list, SSE stream, live tick for running durations |

The `JobsStore` opens a single `EventSource` to `GET /api/jobs/stream` and updates job state in-place on `event: job` frames. A shared 1 Hz tick signal drives live duration display for running jobs.

### Data Grids (ag-grid Community)

All tabular data in the UI uses **ag-grid Community** via `ag-grid-angular`.

#### Module registration

`ModuleRegistry.registerModules([AllCommunityModule])` is called once in `shared/grid/grid.config.ts` (side-effect import from `app.config.ts`).

#### Shared cell renderers

Located in `shared/grid/`:

| Renderer | File | Description |
|---|---|---|
| `StatusBadgeRenderer` | `status-badge.renderer.ts` | Renders `<app-job-status-badge>` for job status values |
| `ImporterTypeRenderer` | `importer-type.renderer.ts` | Renders `<app-importer-type-badge>` for source importer types |
| `DatetimeRenderer` | `datetime.renderer.ts` | Applies `DateTimePipe` to date strings |
| `DurationRenderer` | `duration.renderer.ts` | Applies `DurationPipe` to millisecond values |

#### Page-specific renderers

- `sources/source-link.renderer.ts` — routerLink to source detail
- `sources/toggle-switch.renderer.ts` — PrimeNG ToggleSwitch for enabled/disabled
- `sources/source-actions.renderer.ts` — Import Now / Edit / Delete buttons
- `jobs/job-actions.renderer.ts` — conditional Cancel / Retry / Delete / View buttons
- `jobs/job-source-link.renderer.ts` — source name with routerLink (looks up name via `SourcesStore`)

#### Default column config

```ts
import { defaultColDef } from 'shared/grid';
```

Exported from `grid.config.ts`: `resizable: true`, `suppressMovable: true`, `sortable: true`.

#### Theme

The grid uses `themeQuartz` (loaded via `AllCommunityModule`). CSS variable overrides in `styles.scss` match the PrimeNG Aura palette:

```css
.ag-theme-quartz {
  --ag-foreground-color: var(--p-text-color);
  --ag-background-color: var(--p-surface-0);
  --ag-header-background-color: var(--p-surface-50);
  --ag-border-color: var(--p-surface-300);
  --ag-row-hover-color: var(--p-surface-100);
}
```

### API key interceptor

`ApiKeyInterceptor` (`core/interceptors/api-key.interceptor.ts`) reads the key from a `SettingsService` (backed by `localStorage`) and injects `x-api-key` on every outgoing request when a key is configured.

### Data models

Located in `apps/ui/src/app/core/models/`:

| File | Types |
|---|---|
| `job.model.ts` | `Job`, `JobStatus`, `JobLogEntry` |
| `source.model.ts` | `Source`, `SourceStats`, `CreateSourceDto`, `UpdateSourceDto` |
| `search.model.ts` | `SearchResult`, `SearchParams` |
| `chunk.model.ts` | `ChunkDetail` |
| `doc.model.ts` | `SourceDoc`, `DocChunk` |

---

## Building for Production

```bash
pnpm --filter ui build
```

Output goes to `apps/ui/dist/ui/browser/`. The Fastify server serves this directory as static files when `SERVE_UI=true` (default).

### Docker

The server `Dockerfile` is a multi-stage build:
1. Builds the Angular app (`pnpm --filter ui build`)
2. Copies the output into the server image
3. The Fastify server serves the static files alongside the API

```bash
./infra/build.sh    # Linux / macOS
./infra/build.ps1   # Windows
```

---

## Configuration

### Dev proxy

`apps/ui/proxy.conf.json` proxies these paths to `http://localhost:5000` during development:

```json
{
  "/api":    { "target": "http://localhost:5000", "secure": false },
  "/mcp":    { "target": "http://localhost:5000", "secure": false },
  "/healthz": { "target": "http://localhost:5000", "secure": false }
}
```

### GitHub Packages

`apps/ui/.npmrc` configures the `@gravionlabs` scope to use GitHub Packages. A token with `read:packages` scope is required:

```
@gravionlabs:registry=https://npm.pkg.github.com
```

Set `NODE_AUTH_TOKEN` in your environment before running `pnpm install`.
