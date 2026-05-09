import Fastify from 'fastify';
import { crawlUrl } from './crawler.js';
import { saveChunks } from './db.js';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ status: 'ok' }));

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
      await fetch(`${process.env.SERVER_URL}/api/jobs/${jobId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done', chunkCount: chunks.length }),
      }).catch(() => {}); // best-effort
    } catch (err) {
      app.log.error({ jobId, err }, 'Crawl job failed');
    }
  });

  return reply.code(202).send({ jobId, status: 'accepted' });
});

const port = parseInt(process.env.PORT ?? '3001', 10);
await app.listen({ port, host: '0.0.0.0' });
