import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";
import { SourceService } from "../services/source-service.js";
import { fetchOrThrow } from "../utils/fetch.js";

interface LlmsTxtMeta {
  title?: string;
  description?: string;
  links: Array<{ title: string; url: string; optional?: boolean }>;
}

function parseMetaTxt(text: string): LlmsTxtMeta | null {
  const lines = text.split("\n");
  let title: string | undefined;
  let description: string | undefined;
  const links: Array<{ title: string; url: string; optional?: boolean }> = [];

  let inMainContent = true;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (inMainContent) {
      if (line.startsWith("> ")) {
        description ??= line.slice(2).trim();
        continue;
      }

      if (line.startsWith("- ")) {
        inMainContent = false;
      } else {
        title ??= line.replace(/^#\s*/, "").trim();
        continue;
      }
    }

    if (!inMainContent) {
      const optional = line.includes("[optional]");
      const linkMatch = line.match(
        /-\s*(?:\[optional]\s*)?\[([^\]]+)]\s*\(([^)]+)\)/,
      );
      if (linkMatch) {
        links.push({ title: linkMatch[1], url: linkMatch[2], optional });
      }
    }
  }

  if (links.length === 0) return null;
  return { title, description, links };
}

export class LlmsMetaTxtImporter implements Importer {
  readonly type = "llmstxt-meta";
  private sourceService: SourceService;

  constructor({ sourceService }: { sourceService: SourceService }) {
    this.sourceService = sourceService;
  }

  async import(source: Source): Promise<ImportResult> {
    const res = await fetchOrThrow(source.url);

    const text = await res.text();
    const meta = parseMetaTxt(text);
    if (!meta) return { docCount: 0, chunkCount: 0 };

    for (const link of meta.links) {
      const existing = await this.sourceService.getSourceByUrl(link.url);
      if (existing) continue;

      const existingUrlCheck = await this.sourceService.getSourceByUrl(
        link.url.replace(/\/?$/, "/llms.txt"),
      );
      if (existingUrlCheck) continue;

      await this.sourceService.createSource({
        name: link.title,
        url: link.url,
        importerType: link.url.endsWith(".json") || link.url.endsWith(".yaml") || link.url.endsWith(".yml")
          ? "openapi"
          : "llmstxt-crawl",
      });
    }

    return { docCount: 0, chunkCount: meta.links.length };
  }
}
