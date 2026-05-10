import pg from 'pg';
import type { RawChunk } from './crawler.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ??
    'postgres://noesis:noesis_dev@localhost:5432/noesis',
});

export async function saveChunks(chunks: RawChunk[], sourceId: string): Promise<void> {
  if (chunks.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const chunk of chunks) {
      // Upsert doc
      const docResult = await client.query<{ id: string }>(
        `INSERT INTO docs (source_id, url, title, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (source_id, url) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()
         RETURNING id`,
        [sourceId, chunk.docUrl, chunk.docTitle],
      );
      const docId = docResult.rows[0].id;

      // Insert chunk (skip duplicates by index)
      await client.query(
        `INSERT INTO chunks (doc_id, source_id, content, heading, heading_path, chunk_index)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [docId, sourceId, chunk.content, chunk.heading, chunk.headingPath, chunk.chunkIndex],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
