import amqp from 'amqplib';
import Fastify from 'fastify';
import { crawlUrl, type RawChunk } from './crawler.js';
import { ingestLlmsFullTxt } from './ingestor.js';
import { parseLlmsTxt, extractUrls } from './llmstxt-parser.js';
import { saveChunks } from './db.js';

const app = Fastify({ logger: true });

// ---------------------------------------------------------------------------
// RabbitMQ helpers
// ---------------------------------------------------------------------------

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672/';

async function publishCrawlCompleted(jobId: string, sourceId: string, docCount: number): Promise<void> {
  try {
    const conn = await amqp.connect(RABBITMQ_URL);
    const ch = await conn.createChannel();
    await ch.assertQueue('noesis.crawl-completed', { durable: true });
    ch.sendToQueue(
      'noesis.crawl-completed',
      Buffer.from(JSON.stringify({ jobId, sourceId, docCount })),
      { contentType: 'application/json', persistent: true },
    );
    await ch.close();
    await conn.close();
  } catch (err) {
    app.log.error({ err }, 'Failed to publish CrawlCompleted to RabbitMQ');
  }
}

async function startRabbitMqConsumer(): Promise<void> {
  try {
    const conn = await amqp.connect(RABBITMQ_URL);
    const ch = await conn.createChannel();
    ch.prefetch(1);

    await ch.assertQueue('noesis.start-crawl-job', { durable: true });
    app.log.info('RabbitMQ consumer ready — listening on noesis.start-crawl-job');

    ch.consume('noesis.start-crawl-job', async (msg) => {
      if (!msg) return;
      try {
        const { jobId, sourceId, url, type } = JSON.parse(msg.content.toString());
        app.log.info({ jobId, url, type }, 'StartCrawlJob received from RabbitMQ');

        const chunks = await crawlUrl(url, sourceId, type);
        await saveChunks(chunks, sourceId);
        app.log.info({ jobId, chunks: chunks.length }, 'Crawl job completed');

        await publishCrawlCompleted(jobId, sourceId, chunks.length);
        ch.ack(msg);
      } catch (err) {
        app.log.error({ err }, 'Error handling StartCrawlJob');
        ch.nack(msg, false, false); // dead-letter, don't requeue
      }
    });
  } catch (err) {
    app.log.error({ err }, 'Failed to connect RabbitMQ consumer — starting without it');
  }
}

// ---------------------------------------------------------------------------
// HTTP endpoints (kept for backward-compat / manual dev triggers)
// ---------------------------------------------------------------------------

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
      await publishCrawlCompleted(jobId, sourceId, chunks.length);
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

  setImmediate(async () => {
    try {
      const chunks = await crawlUrl(url, sourceId, type);
      await saveChunks(chunks, sourceId);
      app.log.info({ jobId, chunks: chunks.length }, 'Crawl job completed');
      await publishCrawlCompleted(jobId, sourceId, chunks.length);
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

      const CONCURRENCY = 3;
      const allChunks: RawChunk[] = [];
      for (let i = 0; i < urls.length; i += CONCURRENCY) {
        const batch = urls.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(u => crawlUrl(u, sourceId, 'crawler')));
        for (const chunks of results) allChunks.push(...chunks);
      }

      await saveChunks(allChunks, sourceId);
      app.log.info({ jobId, chunkCount: allChunks.length, pageCount: urls.length }, 'llms.txt crawl completed');
      await publishCrawlCompleted(jobId, sourceId, urls.length);
    } catch (err) {
      app.log.error({ jobId, err }, 'llms.txt crawl job failed');
    }
  });

  return reply.code(202).send({ jobId, status: 'accepted' });
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

const port = parseInt(process.env.PORT ?? '3001', 10);
await app.listen({ port, host: '0.0.0.0' });
await startRabbitMqConsumer();
