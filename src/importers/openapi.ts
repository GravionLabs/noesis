import { query } from "../db/pool.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";

interface OpenApiSpec {
  info?: { title?: string; description?: string };
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
}

export class OpenApiImporter implements Importer {
  readonly type = "openapi";

  async import(source: Source): Promise<ImportResult> {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`Failed to fetch ${source.url}: ${res.status}`);

    const spec = (await res.json()) as OpenApiSpec;
    const title = spec.info?.title ?? new URL(source.url).hostname;
    const specDesc = spec.info?.description ?? "";

    const docResult = await query<{ id: string }>(
      `INSERT INTO docs (source_id, url, title, content_md, content_hash)
       VALUES ($1, $2, $3, $4, md5($4))
       ON CONFLICT (source_id, url)
       DO UPDATE SET title = EXCLUDED.title, content_md = EXCLUDED.content_md,
                     content_hash = EXCLUDED.content_hash, indexed_at = now()
       RETURNING id`,
      [source.id, source.url, title, JSON.stringify(spec, null, 2)],
    );
    const docId = docResult.rows[0].id;

    const paths = spec.paths ?? {};
    const operations: Array<{ method: string; path: string; op: OpenApiOperation }> = [];

    for (const [path, methods] of Object.entries(paths)) {
      for (const method of ["get", "post", "put", "patch", "delete", "options", "head"] as const) {
        const op = methods?.[method];
        if (op) operations.push({ method, path, op });
      }
    }

    if (operations.length === 0) return { docCount: 1, chunkCount: 0 };

    for (let i = 0; i < operations.length; i++) {
      const { method, path, op } = operations[i];
      const content = [
        `## ${method.toUpperCase()} ${path}`,
        op.summary ? `**${op.summary}**` : "",
        op.description ?? "",
        op.operationId ? `Operation ID: ${op.operationId}` : "",
        op.tags?.length ? `Tags: ${op.tags.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      await query(
        `INSERT INTO chunks (doc_id, source_id, content, heading, heading_path, chunk_index)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [
          docId,
          source.id,
          content,
          `${method.toUpperCase()} ${path}`,
          [title, `${method.toUpperCase()} ${path}`],
          i,
        ],
      );
    }

    return { docCount: 1, chunkCount: operations.length };
  }
}
