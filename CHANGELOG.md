# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Features

- Search result quality — chunk noise filtering (#261) (#273)


## [0.0.27] - 2026-06-23

### Features

- Epic #106 — Dashboard with stats, recent jobs, and source chart (#256)


## [0.0.26] - 2026-06-22

### Features

- Epic #109 — Query/Search page with copy & full-chunk dialog (#255)


## [0.0.22] - 2026-06-21

### Documentation

- Add release artifacts — LICENSE, .env.example, changelog, config docs (#251)


## [0.0.21] - 2026-06-21

### Refactor

- Consolidate config module and remove global DB pool (Epic #229) (#250)


## [0.0.20] - 2026-06-21

### Tests

- Postgres integration test suite (Epic #227) (#249)


## [0.0.19] - 2026-06-21

### Tests

- Add unit tests for chunk/stats/embedding services and auth/internal routes (#248)


## [0.0.18] - 2026-06-20

### Tests

- Remove last 3 vi.mock calls, replace with vi.spyOn (#225)


## [0.0.17] - 2026-06-20

### Features

- Create awilix container, wire all dependencies, remove shims


## [0.0.16] - 2026-06-20

### Features

- Convert job-runner, scheduler, mcp/handler to classes with constructor injection (#223)


## [0.0.15] - 2026-06-20

### Features

- Convert 8 importers + azure-devops-provider to classes with constructor injection (#222)


## [0.0.14] - 2026-06-20

### Features

- Service layer classes with backward-compat shims (#221)


## [0.0.13] - 2026-06-20

### Features

- Database class, config module, awilix dependency (#220)


## [0.0.12] - 2026-06-20

### Bug Fixes

- Update Docker lint path to apps/server/Dockerfile (#178)


### Epic

- Angular App Foundation (#104) (#157)

- Move Fastify server to apps/server/ (#158) (#174)

- Serve Angular from Fastify (#159) (#175)

- Biome + Angular UI fixes (#160) (#176)

- Update CI workflow for new monorepo layout (#161) (#177)


## [0.0.11] - 2026-06-20

### Epic

- Server — Search REST Endpoint (#103) (#156)


## [0.0.10] - 2026-06-20

### Epic

- Monorepo Setup (#102) (#155)


## [0.0.9] - 2026-06-19

### Features

- Add observability and stats endpoints (#101)


## [0.0.8] - 2026-06-19

### Epic

- Job Reliability & Retry (#83) (#100)


## [0.0.7] - 2026-06-19

### Features

- Add GET/PATCH /api/sources/:id endpoints and schedule scheduling (#99)


## [0.0.6] - 2026-06-19

### Bug Fixes

- Drop legacy import_job_states table on migration (#81)


### Features

- Test coverage expansion (#70) (#80)


## [0.0.5] - 2026-06-19

### Features

- Api documentation with Scalar (#69) (#78)

- MCP tool expansion (#72) (#79)


## [0.0.4] - 2026-06-19

### Features

- Codebase cleanup & bug fixes (#71)


## [0.0.3] - 2026-06-19

### Miscellaneous

- Remove unused crawler service and rabbitmq from docker-compose, drop dead CRAWLER_URL config


## [0.0.2] - 2026-06-19

### Miscellaneous

- Add db:up/down, dev:docker, chain migrate into db:studio


## [0.0.1] - 2026-06-19

### Bug Fixes

- Docker Compose setup for all 3 services

- Align with docker-compose, fix schemas to public

- Explicit RabbitMQ credentials; add Initial EF migration

- Remove duplicate MassTransit consumer endpoint registrations

- Update HttpTransport configuration to enable stateless mode

- Refactor SearchByVectorAsync to use parameterized SQL for improved security and performance

- Rename huggingface to local for embedding provider default

- Use @main instead of @v1 for GravionLabs/ci actions

- Add checks:write permission and ensure test-results dir

- Resolve pnpm v11 build approval and CI test artifacts

- Bypass composite action's built-in test reporting to fix file discovery

- Add pnpm-workspace.yaml with allowBuilds for pnpm v11

- Skip model-download test in CI to avoid timeout


### CI

- Rewrite using GravionLabs/ci actions + add biome linting


### Documentation

- Update README with event-driven architecture and setup options

- Add comprehensive local development setup guide


### Features

- Add initial implementation of Noesis Embedder with health check and embedding endpoints

- Enhance logging and environment management; add ECS logging support and new environment variables

- Implement MassTransit Saga for import orchestration (Phase 2)

- Update Docker setup instructions and add build script for improved local development

- Enhance Angular import process with new scripts and Docker setup

- Enhance crawler functionality with configurable options and improved URL normalization

- Add MassTransit entity names for crawl and embed job events, update package versions, and introduce Docker Compose override

- Add Seq and Vector for centralized logging and log collection

- TypeScript server with MCP tools, REST API, and RabbitMQ import pipeline

- Add git-workflow skill, agent, and PR template

- Local embedding module with @xenova/transformers

- Import pipeline with 8 importer types and direct async orchestration

- Search module with text + vector search and fallback orchestrator

- Implement scheduler & periodic re-imports (#66)

- Implement AzureDevopsImporter using azure-devops-provider (#33)

- Add API_KEY config, auth middleware, and rate limiting (#35, #36, #37, #38)


### Miscellaneous

- Initial commit (noesis)

- Add pnpm-workspace.yaml to gitignore

- Fixes after review

- Docker, CI, and cleanup of old .NET and Python code

- Approve pnpm build scripts for esbuild, protobufjs, sharp

- Add AZURE_DEVOPS_TOKEN and AZURE_DEVOPS_ORG to config.ts (#32)

- Upgrade Docker base image to node:24-slim

- Pin pnpm version in Dockerfile to fix hadolint DL3016

- Disable Docker publish, add automated GitHub release on main


### Refactor

- Embed crawler into main package under src/crawler

- Embed crawler into main package under src/crawler

- Extract model-download test to integration suite, fix CI step conditions


### Tests

- Add Vitest tests for AzureDevopsImporter (#34)


