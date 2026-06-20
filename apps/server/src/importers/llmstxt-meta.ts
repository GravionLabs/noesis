import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";
import { SourceService } from "../services/source-service.js";
import { db, query, pool } from "../db/pool.js";
import type { Database } from "../db/database.js";

const _defaultDb = {
  db, query, pool,
  getClient: async () => pool.connect(),
  end: async () => { await pool.end(); },
} as unknown as Database;

const _defaultSourceService = new SourceService({ database: _defaultDb });

interface LlmsTxtMeta {
  title?: string;
  description?: string;
  links: Array<{ title: string; url: string; optional?: boolean }>;
}

export class LlmsMetaTxtImporter implements Importer {
  readonly type = "llmstxt-meta";
  private sourceService: SourceService;

  constructor(
    { sourceService }: { sourceService: SourceService } = { sourceService: _defaultSourceService },
  ) {
    this.sourceService = sourceService;
  }

  async import(source: Source): Promise<ImportResult> {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`Failed to fetch ${source.url}: ${res.status}`);

    const text = await res.text();
    const meta = this.parse(text);

    const existing = source.config ? JSON.parse(source.config) : {};
    const updated = { ...existing, ...meta };

    await this.sourceService.updateSource(source.id, { config: JSON.stringify(updated) });

    return { docCount: 0, chunkCount: 0 };
  }

  private parse(text: string): LlmsTxtMeta {
    const lines = text.split("\n");
    const meta: LlmsTxtMeta = { links: [] };

    for (const line of lines) {
      const titleMatch = line.match(/^#\s+(.+)/);
      if (titleMatch && !meta.title) {
        meta.title = titleMatch[1].trim();
        continue;
      }

      const descMatch = line.match(/^>\s*(.+)/);
      if (descMatch && !meta.description) {
        meta.description = descMatch[1].trim();
        continue;
      }

      const linkMatch = line.match(/^-\s*\[(.+)\]\((.+)\)/);
      if (linkMatch) {
        meta.links.push({ title: linkMatch[1].trim(), url: linkMatch[2].trim() });
        continue;
      }

      const optionalSection = line.match(/^##\s+Optional/i);
      if (optionalSection) {
        meta.links = meta.links.map((l) => ({ ...l, optional: true }));
      }
    }

    return meta;
  }
}
