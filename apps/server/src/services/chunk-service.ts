import type { Database } from "../db/database.js";
import { db, query, pool } from "../db/pool.js";

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
}

export class ChunkService {
  private database: Database;

  constructor({ database }: { database: Database }) {
    this.database = database;
  }

  async getChunkWithSource(
    chunkId: string,
  ): Promise<ChunkWithSource | null> {
    const result = await this.database.query<ChunkWithSource>(
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

  async getChunksByDocId(docId: string) {
    const result = await this.database.query(
      `SELECT * FROM chunks WHERE doc_id = $1 ORDER BY chunk_index`,
      [docId],
    );
    return result.rows;
  }

  async getChunksBySourceId(sourceId: string) {
    const result = await this.database.query(
      `SELECT * FROM chunks WHERE source_id = $1 ORDER BY created_at DESC`,
      [sourceId],
    );
    return result.rows;
  }

  async saveChunks(
    chunks: CrawlChunkData[],
    sourceId: string,
  ): Promise<{ docCount: number; chunkCount: number }> {
    if (chunks.length === 0) return { docCount: 0, chunkCount: 0 };

    const client = await this.database.getClient();
    try {
      await client.query("BEGIN");
      let docCount = 0;
      const seenDocs = new Set<string>();

      for (const chunk of chunks) {
        const hasContentMd = chunk.docContentMd !== undefined && chunk.docContentMd !== null;

        const docResult = hasContentMd
          ? await client.query<{ id: string }>(
              `INSERT INTO docs (source_id, url, title, content_md, content_hash, updated_at)
               VALUES ($1, $2, $3, $4, md5($4), NOW())
               ON CONFLICT (source_id, url) DO UPDATE SET title = EXCLUDED.title, content_md = EXCLUDED.content_md, content_hash = EXCLUDED.content_hash, updated_at = NOW()
               RETURNING id`,
              [sourceId, chunk.docUrl, chunk.docTitle, chunk.docContentMd],
            )
          : await client.query<{ id: string }>(
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

        if (!seenDocs.has(chunk.docUrl)) {
          seenDocs.add(chunk.docUrl);
          docCount++;
        }
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
}

const _shimDb = {
  pool,
  db,
  query,
  getClient: async () => pool.connect(),
  end: async () => { await pool.end(); },
} as unknown as Database;

const _shim = new ChunkService({ database: _shimDb });

export const getChunkWithSource = _shim.getChunkWithSource.bind(_shim);
export const getChunksByDocId = _shim.getChunksByDocId.bind(_shim);
export const getChunksBySourceId = _shim.getChunksBySourceId.bind(_shim);
export const saveChunks = _shim.saveChunks.bind(_shim);
