export interface LlmsLink {
  url: string;
  label: string;
  description: string;
}

export interface LlmsMetadata {
  title: string;
  description: string;
  importantLinks: LlmsLink[];
  optionalLinks: LlmsLink[];
}

export function parseLlmsTxt(content: string): LlmsMetadata {
  const lines = content.split("\n");
  let title = "";
  let description = "";
  const importantLinks: LlmsLink[] = [];
  const optionalLinks: LlmsLink[] = [];
  let inOptionalSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      inOptionalSection = false;
      continue;
    }

    if (line.startsWith("## ")) {
      inOptionalSection = line.slice(3).trim().toLowerCase() === "optional";
      continue;
    }

    if (line.startsWith("> ")) {
      description = description ? `${description} ${line.slice(2).trim()}` : line.slice(2).trim();
      continue;
    }

    if (line.startsWith("- ")) {
      const link = parseLink(line.slice(2));
      if (link) {
        if (inOptionalSection) optionalLinks.push(link);
        else importantLinks.push(link);
      }
    }
  }

  return { title, description, importantLinks, optionalLinks };
}

function parseLink(text: string): LlmsLink | null {
  const match = text.match(/^\[([^\]]+)\]\(([^)]+)\)(?::\s*(.*))?$/);
  if (!match) return null;
  return {
    label: match[1],
    url: match[2],
    description: match[3]?.trim() ?? "",
  };
}

export function extractUrls(metadata: LlmsMetadata, includeOptional: boolean): string[] {
  const urls = metadata.importantLinks.map((l) => l.url);
  if (includeOptional) urls.push(...metadata.optionalLinks.map((l) => l.url));
  return urls;
}
