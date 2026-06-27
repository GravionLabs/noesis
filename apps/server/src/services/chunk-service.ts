/**
 * ChunkService — chunk and doc lifecycle management.
 *
 * Tables (owned): chunks, docs (upserted together in saveChunks)
 * Tables (read):  sources (via getChunkWithSource JOIN)
 * Tables (cascade): embeddings auto-deleted by FK on chunks.id ON DELETE CASCADE
 *
 * DB access: Drizzle ORM for all queries; db.transaction() for saveChunks upserts.
 * Key methods:
 *   saveChunks()         — upsert docs + chunks in a single transaction
 *   getChunkWithSource() — JOIN across chunks/docs/sources by chunk UUID
 *   purgeNoisyChunks()   — predicate-based bulk delete (see isLinkListChunk in chunk-utils.ts)
 */
import { eq, desc, inArray, and, sql } from "drizzle-orm";
import { chunks, docs, sources } from "../db/schema.js";
import type { Database } from "../db/database.js";
import { isLinkListChunk } from "../importers/chunk-utils.js";

export interface CrawlChunkData {
  docUrl: string;
  docTitle: string | undefined;
  content: string;
  heading: string | undefined;
  headingPath: string[];
  chunkIndex: number;
  docContentMd?: string;
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
  sourceType: string;
}

export class ChunkService {
  private database: Database;

  constructor({ database }: { database: Database }) {
    this.database = database;
  }

  async getChunkWithSource(chunkId: string): Promise<ChunkWithSource | null> {
    const rows = await this.database.db
      .select({
        chunkId: chunks.id,
        content: chunks.content,
        heading: chunks.heading,
        headingPath: chunks.headingPath,
        chunkIndex: chunks.chunkIndex,
        docUrl: docs.url,
        docTitle: docs.title,
        sourceId: chunks.sourceId,
        sourceName: sources.name,
        sourceType: sources.importerType,
      })
      .from(chunks)
      .innerJoin(docs, eq(docs.id, chunks.docId))
      .innerJoin(sources, eq(sources.id, chunks.sourceId))
      .where(eq(chunks.id, chunkId))
      .limit(1);

    if (!rows[0]) return null;

    const r = rows[0];
    return {
      chunkId: r.chunkId,
      content: r.content,
      heading: r.heading ?? null,
      headingPath: r.headingPath ?? [],
      chunkIndex: r.chunkIndex,
      docUrl: r.docUrl,
      docTitle: r.docTitle ?? null,
      sourceId: r.sourceId!,
      sourceName: r.sourceName,
      sourceType: r.sourceType,
    };
  }

  async getChunksByDocId(docId: string) {
    return this.database.db
      .select()
      .from(chunks)
      .where(eq(chunks.docId, docId))
      .orderBy(chunks.chunkIndex);
  }

  async getChunksBySourceId(sourceId: string) {
    return this.database.db
      .select()
      .from(chunks)
      .where(eq(chunks.sourceId, sourceId))
      .orderBy(desc(chunks.createdAt));
  }

  async saveChunks(
    chunkData: CrawlChunkData[],
    sourceId: string,
  ): Promise<{ docCount: number; chunkCount: number }> {
    if (chunkData.length === 0) return { docCount: 0, chunkCount: 0 };

    let docCount = 0;
    const seenDocs = new Set<string>();

    await this.database.db.transaction(async (tx) => {
      for (const chunk of chunkData) {
        const hasContentMd =
          chunk.docContentMd !== undefined && chunk.docContentMd !== null;

        const conflictSet = hasContentMd
          ? {
              title: sql`EXCLUDED.title`,
              contentMd: sql`EXCLUDED.content_md`,
              contentHash: sql`md5(EXCLUDED.content_md)`,
              updatedAt: sql`NOW()`,
            }
          : {
              title: sql`EXCLUDED.title`,
              updatedAt: sql`NOW()`,
            };

        const docValues: Record<string, unknown> = {
          sourceId,
          url: chunk.docUrl,
          title: chunk.docTitle ?? null,
          updatedAt: new Date(),
        };
        if (hasContentMd) {
          docValues.contentMd = chunk.docContentMd;
          docValues.contentHash = sql`md5(${chunk.docContentMd})`;
        }

        const [doc] = await tx
          .insert(docs)
          .values(docValues as typeof docs.$inferInsert)
          .onConflictDoUpdate({
            target: [docs.sourceId, docs.url],
            set: conflictSet,
          })
          .returning({ id: docs.id });

        const tokenCount = chunk.content.split(/\s+/).filter(Boolean).length;

        await tx
          .insert(chunks)
          .values({
            docId: doc.id,
            sourceId,
            content: chunk.content,
            heading: chunk.heading ?? null,
            headingPath: chunk.headingPath,
            chunkIndex: chunk.chunkIndex,
            tokenCount,
          })
          .onConflictDoNothing();

        if (!seenDocs.has(chunk.docUrl)) {
          seenDocs.add(chunk.docUrl);
          docCount++;
        }
      }
    });

    return { docCount, chunkCount: chunkData.length };
  }

  /**
   * Purges existing chunks that are classified as link-list noise by the
   * same predicate used at ingestion time (`isLinkListChunk` from
   * chunk-utils). This applies the filter retroactively to chunks already
   * stored in the DB — no logic is duplicated.
   *
   * Embeddings are cascade-deleted via the FK `embeddings.chunk_id →
   * chunks.id ON DELETE CASCADE`.
   *
   * @param sourceId - When provided, only chunks for that source are scanned.
   *                   When omitted, ALL sources are scanned (full backfill).
   * @returns `{ purged }` — the number of chunks deleted.
   */
  async purgeNoisyChunks(sourceId?: string): Promise<{ purged: number }> {
    const rows = await this.database.db
      .select({ id: chunks.id, content: chunks.content })
      .from(chunks)
      .where(sourceId ? eq(chunks.sourceId, sourceId) : undefined);

    const toDelete: string[] = [];
    for (const row of rows) {
      if (isLinkListChunk(row.content)) {
        toDelete.push(row.id);
      }
    }

    if (toDelete.length === 0) return { purged: 0 };

    await this.database.db
      .delete(chunks)
      .where(inArray(chunks.id, toDelete));

    return { purged: toDelete.length };
  }
}
