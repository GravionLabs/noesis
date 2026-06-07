# Import Pipeline

## States
- `pending`
- `running`
- `embedding`
- `done`
- `failed`

## Workflow
1. A source is created.
2. An import is triggered for that source.
3. The server creates a job row and publishes `StartImportSaga`.
4. The saga resolves the importer by `ImporterType`.
5. In-process importers publish `ImportCompleted`.
6. The crawler path uses `StartCrawlJob` and publishes `CrawlCompleted`.
7. Either completion path transitions to embedding and publishes `StartEmbedJob`.
8. The embedder consumes `noesis.start-embed-job`, writes vectors, and publishes `EmbedCompleted`.
9. The server marks the job `done` and updates `Source.LastImportedAt`.

## Messages
- `StartImportSaga`
- `ImportCompleted`
- `StartCrawlJob`
- `CrawlCompleted`
- `StartEmbedJob`
- `EmbedCompleted`

## Importer types
- `llmstxt`
- `llmstxt-meta`
- `llmstxt-crawl`
- `crawler`
- `github`
- `azuredevops`
- `npm-readme`
- `openapi`

## Rules
- Import orchestration is asynchronous.
- Jobs are retained for diagnostics.
- `Source.Url` is unique.
