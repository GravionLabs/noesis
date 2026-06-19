import { query, getClient } from "../db/pool.js";

export interface CrawlChunkData {
  docUrl: string;
  docTitle: string | undefined;
  content: string;
  heading: string | undefined;
  headingPath: string[];
  chunkIndex: number;
}

export interface ChunkWithSource {
  chunkId: string;
  content: string;
  heading: string | null;
  headingPath: string[];
  chunkIndex: number;
  docUrl: string;
  docTitle: string | null;
  sourceId: string;
  sourceName: string;
}

export async function getChunkWithSource(
  chunkId: string,
): Promise<ChunkWithSource | null> {
  const result = await query<ChunkWithSource>(
    `SELECT
      c.id          AS chunk_id,
      c.content,
      c.heading,
      c.heading_path,
      c.chunk_index AS "chunkIndex",
      d.url         AS doc_url,
      d.title       AS doc_title,
      c.source_id,
      s.name        AS source_name
    FROM chunks c
    JOIN docs d ON d.id = c.doc_id
    JOIN sources s ON s.id = c.source_id
    WHERE c.id = $1`,
    [chunkId],
  );

  return result.rows[0] ?? null;
}

export async function getChunksByDocId(docId: string) {
  const result = await query(
    `SELECT * FROM chunks WHERE doc_id = $1 ORDER BY chunk_index`,
    [docId],
  );
  return result.rows;
}

export async function getChunksBySourceId(sourceId: string) {
  const result = await query(
    `SELECT * FROM chunks WHERE source_id = $1 ORDER BY created_at DESC`,
    [sourceId],
  );
  return result.rows;
}

export async function saveChunks(
  chunks: CrawlChunkData[],
  sourceId: string,
): Promise<{ docCount: number; chunkCount: number }> {
  if (chunks.length === 0) return { docCount: 0, chunkCount: 0 };

  const client = await getClient();
  try {
    await client.query("BEGIN");
    let docCount = 0;

    for (const chunk of chunks) {
      const docResult = await client.query<{ id: string }>(
        `INSERT INTO docs (source_id, url, title, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (source_id, url) DO UPDATE SET title = EXCLUDED.title, updated_at = NOW()
         RETURNING id`,
        [sourceId, chunk.docUrl, chunk.docTitle],
      );
      const docId = docResult.rows[0].id;

      const tokenCount = chunk.content.split(/\s+/).filter(Boolean).length;
      await client.query(
        `INSERT INTO chunks (doc_id, source_id, content, heading, heading_path, chunk_index, token_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [docId, sourceId, chunk.content, chunk.heading, chunk.headingPath, chunk.chunkIndex, tokenCount],
      );

      docCount++;
    }

    await client.query("COMMIT");
    return { docCount, chunkCount: chunks.length };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
