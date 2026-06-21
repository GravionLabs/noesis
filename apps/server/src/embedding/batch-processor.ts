import type { Database } from "../db/database.js";
import type { EmbeddingProvider } from "./provider.js";

const BATCH_SIZE = 100;

/**
 * Process all chunks that don't have embeddings yet for the given model.
 * Loops in batches of 100 until all pending chunks are embedded.
 * Returns the total number of embeddings created.
 */
export async function processPendingChunks(
  database: Database,
  provider: EmbeddingProvider,
  sourceId?: string,
): Promise<number> {
  let total = 0;

  while (true) {
    let sql = `
      SELECT c.id, c.content
      FROM chunks c
      WHERE NOT EXISTS (
        SELECT 1 FROM embeddings e
        WHERE e.chunk_id = c.id AND e.model = $1
      )
    `;
    const params: unknown[] = [provider.model];

    if (sourceId) {
      sql += ` AND c.source_id = $2`;
      params.push(sourceId);
    }

    sql += ` LIMIT $${params.length + 1}`;
    params.push(BATCH_SIZE);

    const result = await database.query<{ id: string; content: string }>(sql, params);

    if (result.rows.length === 0) break;

    const texts = result.rows.map((r) => r.content);
    const vectors = await provider.embed(texts);

    for (let i = 0; i < result.rows.length; i++) {
      const chunkId = result.rows[i].id;
      const vector = vectors[i];
      if (!vector || vector.length === 0) continue;

      await database.query(
        `INSERT INTO embeddings (chunk_id, model, dimensions, vector)
         VALUES ($1, $2, $3, $4::vector)
         ON CONFLICT (chunk_id, model) DO NOTHING`,
        [chunkId, provider.model, provider.dimensions, `[${vector.join(",")}]`],
      );
    }

    total += result.rows.length;
  }

  return total;
}

/**
 * Count how many chunks are still pending embedding.
 */
export async function countPendingChunks(
  database: Database,
  model: string,
  sourceId?: string,
): Promise<number> {
  let sql = `
    SELECT COUNT(*)::int AS count
    FROM chunks c
    WHERE NOT EXISTS (
      SELECT 1 FROM embeddings e
      WHERE e.chunk_id = c.id AND e.model = $1
    )
  `;
  const params: unknown[] = [model];

  if (sourceId) {
    sql += ` AND c.source_id = $2`;
    params.push(sourceId);
  }

  const result = await database.query<{ count: number }>(sql, params);
  return result.rows[0]?.count ?? 0;
}
