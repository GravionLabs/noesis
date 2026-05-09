import type { RawChunk } from './crawler.js';

/**
 * Fetches an llms-full.txt file via HTTP and splits it into chunks.
 * Uses plain fetch() — no Playwright required, since llms-full.txt is a raw text file.
 */
export async function ingestLlmsFullTxt(url: string, sourceId: string): Promise<RawChunk[]> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const markdown = await res.text();
  return chunkLlmsFullTxt(markdown, url);
}

function chunkLlmsFullTxt(markdown: string, url: string): RawChunk[] {
  const MAX_CHARS = 2000;
  const chunks: RawChunk[] = [];

  let title: string | undefined;
  let currentHeading: string | undefined;
  const headingPath: string[] = [];
  let buffer = '';
  let chunkIndex = 0;

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed.length > 50) {
      chunks.push({
        docUrl: url,
        docTitle: title,
        content: trimmed,
        heading: currentHeading,
        headingPath: [...headingPath],
        chunkIndex: chunkIndex++,
      });
    }
    buffer = '';
  };

  for (const line of markdown.split('\n')) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      flush();
      const level = headingMatch[1].length;
      currentHeading = headingMatch[2].trim();

      if (level === 1 && !title) {
        title = currentHeading;
      }

      headingPath.splice(level - 1);
      headingPath[level - 1] = currentHeading;
    } else {
      buffer += line + '\n';
      if (buffer.length >= MAX_CHARS) flush();
    }
  }
  flush();

  return chunks;
}
