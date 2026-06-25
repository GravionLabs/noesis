/**
 * Embedding batch processor — finds unembedded chunks and generates vectors.
 *
 * Tables (read):  chunks (anti-join against embeddings)
 * Tables (write): embeddings (upsert via onConflictDoNothing)
 *
 * DB access: Drizzle ORM with notExists() for the anti-join subquery;
 *   onConflictDoNothing() for idempotent embedding upserts.
 *   The floatVec custom type in schema.ts serialises number[] ↔ "[...]" string
 *   so no manual ::vector cast is required here.
 */
import { and, eq, notExists, count, sql } from "drizzle-orm";
import { chunks, embeddings } from "../db/schema.js";
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
    const unembedded = database.db
      .select({ one: sql`1` })
      .from(embeddings)
      .where(
        and(
          eq(embeddings.chunkId, chunks.id),
          eq(embeddings.model, provider.model),
        ),
      );

    const batch = await database.db
      .select({ id: chunks.id, content: chunks.content })
      .from(chunks)
      .where(
        and(
          notExists(unembedded),
          ...(sourceId ? [eq(chunks.sourceId, sourceId)] : []),
        ),
      )
      .limit(BATCH_SIZE);

    if (batch.length === 0) break;

    const texts = batch.map((r) => r.content);
    const vectors = await provider.embed(texts);

    for (let i = 0; i < batch.length; i++) {
      const chunkId = batch[i].id;
      const vector = vectors[i];
      if (!vector || vector.length === 0) continue;

      await database.db
        .insert(embeddings)
        .values({
          chunkId,
          model: provider.model,
          dimensions: provider.dimensions,
          vector,
        })
        .onConflictDoNothing();
    }

    total += batch.length;
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
  const unembedded = database.db
    .select({ one: sql`1` })
    .from(embeddings)
    .where(and(eq(embeddings.chunkId, chunks.id), eq(embeddings.model, model)));

  const r = await database.db
    .select({ count: count() })
    .from(chunks)
    .where(
      and(
        notExists(unembedded),
        ...(sourceId ? [eq(chunks.sourceId, sourceId)] : []),
      ),
    );

  return Number(r[0]?.count ?? 0);
}
