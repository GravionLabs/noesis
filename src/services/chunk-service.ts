import { query } from "../db/pool.js";

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
