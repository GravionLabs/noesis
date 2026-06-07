export interface RawChunk {
  content: string;
  heading: string | undefined;
  headingPath: string[];
  chunkIndex: number;
}

const MAX_CHARS = 2000;

export function chunkMarkdown(text: string): RawChunk[] {
  const chunks: RawChunk[] = [];
  const headingPath: string[] = [];
  let currentHeading: string | undefined;
  let buffer = "";
  let chunkIndex = 0;

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed.length > 50) {
      chunks.push({
        content: trimmed,
        heading: currentHeading,
        headingPath: [...headingPath],
        chunkIndex: chunkIndex++,
      });
    }
    buffer = "";
  };

  for (const line of text.split("\n")) {
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
