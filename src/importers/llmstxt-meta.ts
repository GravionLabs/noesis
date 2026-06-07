import { db } from "../db/pool.js";
import { sources } from "../db/schema.js";
import { eq } from "drizzle-orm";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";

interface LlmsTxtMeta {
  title?: string;
  description?: string;
  links: Array<{ title: string; url: string; optional?: boolean }>;
}

export class LlmsMetaTxtImporter implements Importer {
  readonly type = "llmstxt-meta";

  async import(source: Source): Promise<ImportResult> {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`Failed to fetch ${source.url}: ${res.status}`);

    const text = await res.text();
    const meta = this.parse(text);

    const existing = source.config ? JSON.parse(source.config) : {};
    const updated = { ...existing, ...meta };

    await db
      .update(sources)
      .set({ config: JSON.stringify(updated), updatedAt: new Date() })
      .where(eq(sources.id, source.id));

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
