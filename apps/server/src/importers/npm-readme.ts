import { query } from "../db/pool.js";
import { chunkMarkdown } from "./chunk-utils.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";

export class NpmReadmeImporter implements Importer {
  readonly type = "npm-readme";

  async import(source: Source): Promise<ImportResult> {
    const pkgName = this.extractPackageName(source.url);
    const res = await fetch(`https://registry.npmjs.org/${pkgName}`);
    if (!res.ok) throw new Error(`npm registry returned ${res.status}`);

    const data = (await res.json()) as {
      name?: string;
      description?: string;
      readme?: string;
    };

    const readme = data.readme ?? "";
    if (!readme.trim()) return { docCount: 0, chunkCount: 0 };

    const title = `${data.name ?? pkgName}: ${data.description ?? "README"}`;
    const chunks = chunkMarkdown(readme);
    if (chunks.length === 0) return { docCount: 0, chunkCount: 0 };

    const docResult = await query<{ id: string }>(
      `INSERT INTO docs (source_id, url, title, content_md, content_hash)
       VALUES ($1, $2, $3, $4, md5($4))
       ON CONFLICT (source_id, url)
       DO UPDATE SET title = EXCLUDED.title, content_md = EXCLUDED.content_md,
                     content_hash = EXCLUDED.content_hash, indexed_at = now()
       RETURNING id`,
      [source.id, source.url, title, readme],
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

  private extractPackageName(url: string): string {
    const u = new URL(url);
    const parts = u.pathname.replace(/\/$/, "").split("/");
    return parts[parts.length - 1] || parts[parts.length - 2] || "lodash";
  }
}
