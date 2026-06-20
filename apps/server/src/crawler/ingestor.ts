import { chunkMarkdown } from "../importers/chunk-utils.js";
import type { CrawlChunk } from "./crawler.js";

export async function ingestLlmsFullTxt(url: string): Promise<CrawlChunk[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);

  const markdown = await res.text();
  const title = markdown.match(/^#\s+(.+)/m)?.[1]?.trim() ?? new URL(url).hostname;

  const rawChunks = chunkMarkdown(markdown);
  return rawChunks.map((c) => ({
    ...c,
    docUrl: url,
    docTitle: title,
  }));
}
