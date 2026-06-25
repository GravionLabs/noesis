export interface RawChunk {
  content: string;
  heading: string | undefined;
  headingPath: string[];
  chunkIndex: number;
  tokenCount: number;
}

export interface ChunkMarkdownResult {
  chunks: RawChunk[];
  droppedCount: number;
}

/** Minimum character length for a chunk to be kept. */
export const MIN_CHUNK_CHARS = 50;

/**
 * Maximum fraction of non-empty, non-fenced-code lines that may be
 * markdown link-list lines before the entire chunk is dropped.
 */
export const LINK_LIST_RATIO = 0.7;

const MAX_CHARS = 2000;

// Matches a line that is *entirely* a single HTML open/close tag, e.g.
// `<div style="margin: 2em">` or `</docs-nav-card>`. llms.txt-style docs
// (e.g. angular.dev) embed raw layout/component markup like this around
// otherwise-plain markdown; stripping just these structural lines removes
// the tag noise while leaving inline code (e.g. `Array<string>`) untouched,
// since that never forms a whole trimmed line by itself.
const HTML_TAG_LINE = /^<\/?[a-zA-Z][\w-]*(\s+[^<>]*)?\/?>$/;

/**
 * Matches a markdown link-list line (unordered or ordered), e.g.
 *   - [Text](url)
 *   * [Text](url) — description
 *   1. [Text](url)
 */
const LINK_LIST_LINE = /^\s*(?:[-*+]|\d+\.)\s*\[.+?\]\(.+?\).*$/;

/**
 * Returns `true` when more than `LINK_LIST_RATIO` of the non-empty lines
 * in `text` that are *outside* fenced code blocks match the link-list
 * pattern. Used to drop "index / see-also" sections that carry no real
 * prose and only dilute search results.
 *
 * Exported so #269 backfill can reuse the predicate without duplication.
 */
export function isLinkListChunk(text: string): boolean {
  let totalLines = 0;
  let linkLines = 0;
  let inFencedCode = false;

  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFencedCode = !inFencedCode;
      continue;
    }
    if (inFencedCode) continue;
    if (line.trim() === "") continue;

    totalLines++;
    if (LINK_LIST_LINE.test(line)) linkLines++;
  }

  if (totalLines === 0) return false;
  return linkLines / totalLines > LINK_LIST_RATIO;
}

export function chunkMarkdown(text: string): ChunkMarkdownResult {
  const chunks: RawChunk[] = [];
  const headingPath: string[] = [];
  let currentHeading: string | undefined;
  let buffer = "";
  let chunkIndex = 0;
  let droppedCount = 0;
  let inFencedCode = false;

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed.length > MIN_CHUNK_CHARS) {
      if (isLinkListChunk(trimmed)) {
        droppedCount++;
      } else {
        chunks.push({
          content: trimmed,
          heading: currentHeading,
          headingPath: [...headingPath],
          chunkIndex: chunkIndex++,
          tokenCount: trimmed.split(/\s+/).filter(Boolean).length,
        });
      }
    }
    buffer = "";
  };

  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) inFencedCode = !inFencedCode;
    if (!inFencedCode && HTML_TAG_LINE.test(line.trim())) continue;

    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      flush();
      const level = headingMatch[1].length;
      currentHeading = headingMatch[2];
      headingPath.splice(level - 1);
      headingPath[level - 1] = currentHeading;
    } else {
      buffer += line + "\n";
      if (buffer.length >= MAX_CHARS) flush();
    }
  }
  flush();

  return { chunks, droppedCount };
}
