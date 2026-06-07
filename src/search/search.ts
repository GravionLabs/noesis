import { query } from "../db/pool.js";
import { getProvider } from "../services/embedding-service.js";

export interface SearchResult {
  sourceName: string;
  docUrl: string;
  docTitle: string | null;
  heading: string | null;
  content: string;
  score: number;
  chunkId: string;
}

export interface SearchResultRow {
  chunk_id: string;
  content: string;
  heading: string | null;
  doc_url: string;
  doc_title: string | null;
  source_name: string;
  score: number;
}

function mapRow(r: SearchResultRow): SearchResult {
  return {
    chunkId: r.chunk_id,
    content: r.content,
    heading: r.heading,
    docUrl: r.doc_url,
    docTitle: r.doc_title,
    sourceName: r.source_name,
    score: r.score,
  };
}

export async function searchByText(
  searchQuery: string,
  limit = 10,
  sourceName?: string,
): Promise<SearchResult[]> {
  let sql = `
    SELECT
      c.id          AS chunk_id,
      c.content,
      c.heading,
      d.url         AS doc_url,
      d.title       AS doc_title,
      s.name        AS source_name,
      ts_rank(to_tsvector('english', c.content),
              plainto_tsquery('english', $1)) AS score
    FROM chunks c
    JOIN docs d ON d.id = c.doc_id
    JOIN sources s ON s.id = c.source_id
    WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', $1)
  `;

  const params: unknown[] = [searchQuery];
  let paramIdx = 2;

  if (sourceName) {
    sql += ` AND s.name = $${paramIdx++}`;
    params.push(sourceName);
  }

  sql += ` ORDER BY score DESC LIMIT $${paramIdx}`;
  params.push(limit);

  const result = await query<SearchResultRow>(sql, params);
  return result.rows.map(mapRow);
}

export async function searchByVector(
  vector: number[],
  limit = 10,
  sourceName?: string,
): Promise<SearchResult[]> {
  const dims = vector.length;
  const vectorLit = `[${vector.join(",")}]`;

  let sql = `
    SELECT
      c.id          AS chunk_id,
      c.content,
      c.heading,
      d.url         AS doc_url,
      d.title       AS doc_title,
      s.name        AS source_name,
      1 - (e.vector <=> $1::vector) AS score
    FROM embeddings e
    JOIN chunks c ON c.id = e.chunk_id
    JOIN docs d ON d.id = c.doc_id
    JOIN sources s ON s.id = c.source_id
    WHERE e.dimensions = $2
  `;

  const params: unknown[] = [vectorLit, dims];
  let paramIdx = 3;

  if (sourceName) {
    sql += ` AND s.name = $${paramIdx++}`;
    params.push(sourceName);
  }

  sql += ` ORDER BY e.vector <=> $1::vector LIMIT $${paramIdx}`;
  params.push(limit);

  const result = await query<SearchResultRow>(sql, params);
  return result.rows.map(mapRow);
}

export async function searchDocs(
  queryText: string,
  limit = 5,
  sourceName?: string,
): Promise<SearchResult[]> {
  try {
    const provider = getProvider();
    const vector = await provider.embed([queryText]);
    if (vector[0]?.length) {
      return searchByVector(vector[0], limit, sourceName);
    }
  } catch {
    // Embedder unavailable — fall through to text search
  }

  return searchByText(queryText, limit, sourceName);
}
