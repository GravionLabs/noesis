export interface RawChunk {
  content: string;
  heading: string | undefined;
  headingPath: string[];
  chunkIndex: number;
  tokenCount: number;
}

const MAX_CHARS = 2000;

// Matches a line that is *entirely* a single HTML open/close tag, e.g.
// `<div style="margin: 2em">` or `</docs-nav-card>`. llms.txt-style docs
// (e.g. angular.dev) embed raw layout/component markup like this around
// otherwise-plain markdown; stripping just these structural lines removes
// the tag noise while leaving inline code (e.g. `Array<string>`) untouched,
// since that never forms a whole trimmed line by itself.
const HTML_TAG_LINE = /^<\/?[a-zA-Z][\w-]*(\s+[^<>]*)?\/?>$/;

export function chunkMarkdown(text: string): RawChunk[] {
  const chunks: RawChunk[] = [];
  const headingPath: string[] = [];
  let currentHeading: string | undefined;
  let buffer = "";
  let chunkIndex = 0;
  let inFencedCode = false;

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed.length > 50) {
      chunks.push({
        content: trimmed,
        heading: currentHeading,
        headingPath: [...headingPath],
        chunkIndex: chunkIndex++,
        tokenCount: trimmed.split(/\s+/).filter(Boolean).length,
      });
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

  return chunks;
}
