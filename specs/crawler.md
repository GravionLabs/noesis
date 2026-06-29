# Crawler

Describes the embedded Playwright crawler used by the `crawler` and `llmstxt-crawl` importers.

---

## Overview

The crawler runs **in-process** inside the Fastify server — there is no separate crawler service or HTTP endpoint for crawling. Playwright is a direct dependency of `apps/server` and is invoked programmatically.

---

## Entry Point

```ts
crawlUrl(startUrl: string, config?: CrawlConfig): Promise<CrawlResult>
```

Located at `apps/server/src/crawler/crawler.ts`.

---

## Configuration

```ts
interface CrawlConfig {
  maxDepth?:      number;    // default 5 — max link-follow depth
  maxPages?:      number;    // default 200 — max pages to visit
  maxChunks?:     number;    // stop after this many chunks
  maxBytes?:      number;    // stop after this many content bytes
  concurrency?:   number;    // default 4 — parallel page fetches
  maxPageRetries?: number;   // default 2 — retries per page on error
  crawlDelayMs?:  number;    // default 0 — delay between page fetches
  incremental?:   boolean;   // skip pages whose content hash hasn't changed
  knownHashes?:   Map<string, string>; // hash map from previous run
  signal?:        AbortSignal;         // cancellation signal
}
```

---

## Result

```ts
interface CrawlResult {
  chunks: CrawlChunk[];
  stoppedReason?: "maxChunks" | "maxBytes" | "maxPages" | "cancelled";
  visitedCount: number;
  skippedCount: number;
  failedCount: number;
}
```

Each `CrawlChunk` contains `docUrl`, `docTitle`, `content`, `heading`, `headingPath`, and `chunkIndex`.

---

## Crawl Behaviour

1. Start from `startUrl`.
2. Fetch the page with Playwright, extract text content, split into chunks by heading.
3. Collect outgoing links that share the same origin and path prefix as the start URL.
4. Enqueue links up to `maxDepth`. Run up to `concurrency` fetches in parallel.
5. Stop early if `maxPages`, `maxChunks`, `maxBytes`, or the `AbortSignal` fires.
6. In incremental mode, compare the page content hash to `knownHashes` and skip unchanged pages.

---

## Chunking

After fetching each page, content is split into chunks by heading hierarchy (`apps/server/src/importers/chunk-utils.ts`). Short chunks (below a minimum token threshold) and pure link-list chunks (high ratio of anchor text to body text) are filtered out.

---

## llms.txt crawl

The `LlmsTxtCrawlImporter` uses `crawlUrl` in a batched loop:

1. Fetch `llms.txt` from the source URL.
2. Parse the file to extract a list of documentation page URLs.
3. Crawl the pages in batches of 3 (`CONCURRENCY = 3`), passing the shared `AbortSignal`.
4. Save each batch's chunks incrementally so partial results survive cancellation.
5. Abort after `MAX_CONSECUTIVE_FAILURES = 10` consecutive batch failures.
