import { query } from "../db/pool.js";

export interface SearchResult {
  chunkId: string;
  content: string;
  heading: string | null;
  headingPath: string[];
  docUrl: string;
  docTitle: string | null;
  sourceId: string;
  sourceName: string;
  score: number;
}

export async function searchChunks(
  embedding: number[],
  limit = 10,
  sourceId?: string,
): Promise<SearchResult[]> {
  const dims = embedding.length;
  const vectorLit = `[${embedding.join(",")}]`;

  let sql = `
    SELECT
      c.id          AS chunk_id,
      c.content,
      c.heading,
      c.heading_path,
      d.url         AS doc_url,
      d.title       AS doc_title,
      c.source_id,
      s.name        AS source_name,
      1 - (e.vector <=> $1::vector) AS score
    FROM embeddings e
    JOIN chunks c ON c.id = e.chunk_id
    JOIN docs d ON d.id = c.doc_id
    JOIN sources s ON s.id = c.source_id
    WHERE e.dimensions = $2
  `;

  const params: unknown[] = [vectorLit, dims];

  if (sourceId) {
    sql += ` AND c.source_id = $3`;
    params.push(sourceId);
  }

  sql += ` ORDER BY e.vector <=> $1::vector LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await query<SearchResult>(sql, params);
  return result.rows;
}
