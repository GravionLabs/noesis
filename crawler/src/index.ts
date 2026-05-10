import Fastify from 'fastify';
import { crawlUrl, type RawChunk } from './crawler.js';
import { ingestLlmsFullTxt } from './ingestor.js';
import { parseLlmsTxt, extractUrls } from './llmstxt-parser.js';
import { saveChunks } from './db.js';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ status: 'ok' }));

app.post<{
  Body: { jobId: string; sourceId: string; url: string };
}>('/jobs/ingest-llmstxt', async (req, reply) => {
  const { jobId, sourceId, url } = req.body;

  app.log.info({ jobId, url }, 'Starting llms-full.txt ingest job');

  setImmediate(async () => {
    try {
      const chunks = await ingestLlmsFullTxt(url, sourceId);
      await saveChunks(chunks, sourceId);
      app.log.info({ jobId, chunks: chunks.length }, 'llms-full.txt ingest job completed');

      await fetch(`${process.env.SERVER_URL}/api/internal/crawl-completed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, sourceId, docCount: chunks.length }),
      }).catch(() => {});
    } catch (err) {
      app.log.error({ jobId, err }, 'llms-full.txt ingest job failed');
    }
  });

  return reply.code(202).send({ jobId, status: 'accepted' });
});

app.post<{
  Body: { jobId: string; sourceId: string; url: string; type: string };
}>('/jobs/crawl', async (req, reply) => {
  const { jobId, sourceId, url, type } = req.body;

  app.log.info({ jobId, url }, 'Starting crawl job');

  // Run async, don't block the response
  setImmediate(async () => {
    try {
      const chunks = await crawlUrl(url, sourceId, type);
      await saveChunks(chunks, sourceId);
      app.log.info({ jobId, chunks: chunks.length }, 'Crawl job completed');

      // Notify server of completion
      await fetch(`${process.env.SERVER_URL}/api/internal/crawl-completed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, sourceId, docCount: chunks.length }),
      }).catch(() => {}); // best-effort
    } catch (err) {
      app.log.error({ jobId, err }, 'Crawl job failed');
    }
  });

  return reply.code(202).send({ jobId, status: 'accepted' });
});

app.post<{
  Body: { jobId: string; sourceId: string; url: string; includeOptional?: boolean };
}>('/jobs/crawl-llmstxt', async (req, reply) => {
  const { jobId, sourceId, url, includeOptional = false } = req.body;

  app.log.info({ jobId, url, includeOptional }, 'Starting llms.txt sub-page crawl job');

  setImmediate(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
      const content = await res.text();

      const metadata = parseLlmsTxt(content);
      const urls = extractUrls(metadata, includeOptional);
      app.log.info({ jobId, pageCount: urls.length }, 'Crawling pages extracted from llms.txt');

      // Crawl with a concurrency limit of 3 to avoid exhausting browser resources
      const CONCURRENCY = 3;
      const allChunks: RawChunk[] = [];
      for (let i = 0; i < urls.length; i += CONCURRENCY) {
        const batch = urls.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(u => crawlUrl(u, sourceId, 'crawler')));
        for (const chunks of results) allChunks.push(...chunks);
      }

      await saveChunks(allChunks, sourceId);
      app.log.info({ jobId, chunkCount: allChunks.length, pageCount: urls.length }, 'llms.txt crawl completed');

      await fetch(`${process.env.SERVER_URL}/api/internal/crawl-completed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, sourceId, docCount: urls.length }),
      }).catch(() => {});
    } catch (err) {
      app.log.error({ jobId, err }, 'llms.txt crawl job failed');
    }
  });

  return reply.code(202).send({ jobId, status: 'accepted' });
});

const port = parseInt(process.env.PORT ?? '3001', 10);
await app.listen({ port, host: '0.0.0.0' });
