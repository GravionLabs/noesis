import { query } from "../db/pool.js";
import { chunkMarkdown, type RawChunk } from "./chunk-utils.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";

export class LlmsTxtImporter implements Importer {
  readonly type = "llmstxt";

  async import(source: Source): Promise<ImportResult> {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`Failed to fetch ${source.url}: ${res.status}`);

    const text = await res.text();
    const chunks = chunkMarkdown(text);
    if (chunks.length === 0) return { docCount: 0, chunkCount: 0 };

    const title = text.match(/^#\s+(.+)/m)?.[1]?.trim() ?? new URL(source.url).hostname;

    const docResult = await query<{ id: string }>(
      `INSERT INTO docs (source_id, url, title, content_md, content_hash)
       VALUES ($1, $2, $3, $4, md5($4))
       ON CONFLICT (source_id, url)
       DO UPDATE SET title = EXCLUDED.title, content_md = EXCLUDED.content_md,
                     content_hash = EXCLUDED.content_hash, indexed_at = now()
       RETURNING id`,
      [source.id, source.url, title, text],
    );
    const docId = docResult.rows[0].id;

    for (const chunk of chunks) {
      await query(
        `INSERT INTO chunks (doc_id, source_id, content, heading, heading_path, chunk_index, token_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT DO NOTHING`,
        [docId, source.id, chunk.content, chunk.heading, chunk.headingPath, chunk.chunkIndex, chunk.tokenCount],
      );
    }

    return { docCount: 1, chunkCount: chunks.length };
  }
}
