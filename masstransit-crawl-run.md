# Crawling the MassTransit website

## Prerequisites

- The Docker stack is running (`infra/docker-compose.yml`)
- Noesis Server is running at `http://localhost:5000`
- The crawler image is up to date
- After changing event routing code, rebuild/restart the server so `StartCrawlJob`
  is published with the configured entity name `noesis.start-crawl-job`

## Recommendation

For the MassTransit website, the `crawler` importer is the standard approach:

- `StartCrawlJob` is published on `noesis.start-crawl-job`.
- The crawler reads the site via Playwright, follows internal links, and optionally uses the sitemap.
- After the crawl, `CrawlCompleted` is published back to the server on `noesis.crawl-completed`.

If the site also provides a compact `llms.txt`, you can alternatively use the
`llmstxt-crawl` importer.

## 1. (Optional) Rebuild the crawler image

```bash
docker compose -f infra/docker-compose.yml build crawler
docker compose -f infra/docker-compose.yml up -d crawler
```

## 1b. Restart the server (after routing changes)

```bash
cd server
dotnet build Gravion.Noesis.slnx
dotnet run --project src/Gravion.Noesis.Server
```

## 2. Create the MassTransit source

```bash
curl -X POST http://localhost:5000/api/sources \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "MassTransit Docs",
    "url": "https://masstransit.massient.com/",
    "importerType": "crawler",
    "config": "{\"maxDepth\":2,\"maxPages\":150,\"includeSitemap\":true,\"pageTimeoutMs\":30000,\"sameOriginOnly\":true,\"crawlDelayMs\":250}"
  }'
```

The response contains the source `id`.

## 3. Start the import

```bash
SOURCE_ID="<source-id-from-step-2>"
curl -X POST http://localhost:5000/api/sources/$SOURCE_ID/import
```

The response contains the `jobId`.

## 4. Check the job status

```bash
JOB_ID="<job-id-aus-schritt-3>"
curl http://localhost:5000/api/jobs/$JOB_ID
```

Expected progression: `pending -> running -> embedding -> done`.

## Relevant crawl options

| Option | Purpose | Typical value |
|---|---|---|
| `maxDepth` | How deep internal links are followed | `2` |
| `maxPages` | Upper limit for crawled pages | `100`–`200` |
| `includeSitemap` | Use the sitemap as an additional starting source | `true` |
| `pageTimeoutMs` | Timeout per page | `30000` |
| `sameOriginOnly` | Crawl only pages on the same origin | `true` |
| `crawlDelayMs` | Delay between fetches | `200`–`500` |

## If the site has `llms.txt`

```bash
curl -X POST http://localhost:5000/api/sources \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "MassTransit Docs (llms.txt)",
    "url": "https://masstransit.massient.com/llms.txt",
    "importerType": "llmstxt-crawl",
    "config": "{\"includeOptional\":true}"
  }'
```
