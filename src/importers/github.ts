import { query } from "../db/pool.js";
import { chunkMarkdown } from "./chunk-utils.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";

export class GithubImporter implements Importer {
  readonly type = "github";

  async import(source: Source): Promise<ImportResult> {
    const match = source.url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error("Invalid GitHub URL");

    const [, owner, repo] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;

    const res = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.raw" },
    });
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);

    const md = await res.text();
    const chunks = chunkMarkdown(md);
    if (chunks.length === 0) return { docCount: 0, chunkCount: 0 };

    const title = `${owner}/${repo} README`;

    const docResult = await query<{ id: string }>(
      `INSERT INTO docs (source_id, url, title, content_md, content_hash)
       VALUES ($1, $2, $3, $4, md5($4))
       ON CONFLICT (source_id, url)
       DO UPDATE SET title = EXCLUDED.title, content_md = EXCLUDED.content_md,
                     content_hash = EXCLUDED.content_hash, indexed_at = now()
       RETURNING id`,
      [source.id, source.url, title, md],
    );
    const docId = docResult.rows[0].id;

    for (const chunk of chunks) {
      await query(
        `INSERT INTO chunks (doc_id, source_id, content, heading, heading_path, chunk_index)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [docId, source.id, chunk.content, chunk.heading, chunk.headingPath, chunk.chunkIndex],
      );
    }

    return { docCount: 1, chunkCount: chunks.length };
  }
}
