import type { Config } from "../../config/index.js";
import { RepositoryProvider, type RepositoryFileInfo, type RepositoryContent } from "./repository-provider.js";

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/#?]+?)(?:\/|\.git|$)/);
  if (match) return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
  return null;
}

export class GithubProvider implements RepositoryProvider {
  name = "github";
  private config: Config;

  constructor({ config }: { config: Config }) {
    this.config = config;
  }

  canHandle(url: string): boolean {
    return url.includes("github.com");
  }

  private apiHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "Noesis/1.0",
    };
    if (this.config.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${this.config.GITHUB_TOKEN}`;
    }
    return headers;
  }

  async listFiles(repoUrl: string, path = "", maxDepth = 4): Promise<RepositoryFileInfo[]> {
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) throw new Error(`Invalid GitHub URL: ${repoUrl}`);

    const files: RepositoryFileInfo[] = [];
    const queue: Array<{ path: string; depth: number }> = [{ path, depth: 0 }];

    while (queue.length > 0) {
      const entry = queue.shift()!;
      if (entry.depth > maxDepth) continue;

      const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${encodeURIComponent(entry.path)}`;
      const res = await fetch(url, { headers: this.apiHeaders() });
      if (!res.ok) continue;

      const data = (await res.json()) as Array<{ name: string; path: string; type: string; size?: number }>;
      if (!Array.isArray(data)) continue;

      for (const item of data) {
        const info: RepositoryFileInfo = {
          path: item.path,
          isDirectory: item.type === "dir",
          size: item.size,
        };
        files.push(info);
        if (item.type === "dir" && entry.depth < maxDepth) {
          queue.push({ path: item.path, depth: entry.depth + 1 });
        }
      }
    }

    return files;
  }

  async getFile(repoUrl: string, filePath: string): Promise<RepositoryContent> {
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) throw new Error(`Invalid GitHub URL: ${repoUrl}`);

    const tryFetch = async (branch: string): Promise<Response> => {
      const url = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}/${filePath}`;
      return fetch(url, { headers: { "User-Agent": "Noesis/1.0" } });
    };

    const res = await tryFetch("main");
    if (res.ok) return { path: filePath, content: await res.text() };

    const fallback = await tryFetch("master");
    if (!fallback.ok) throw new Error(`Failed to fetch ${filePath} from ${parsed.owner}/${parsed.repo}`);

    return { path: filePath, content: await fallback.text() };
  }

  async getReadme(repoUrl: string): Promise<RepositoryContent | null> {
    for (const name of ["README.md", "readme.md", "README", "readme"]) {
      try {
        return await this.getFile(repoUrl, name);
      } catch {
        // continue
      }
    }
    return null;
  }

  async getDocFiles(repoUrl: string): Promise<RepositoryFileInfo[]> {
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) return [];

    for (const docDir of ["docs", "doc", "documentation"]) {
      const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${encodeURIComponent(docDir)}`;
      const res = await fetch(url, { headers: this.apiHeaders() });
      if (!res.ok) continue;

      const data = (await res.json()) as Array<{ name: string; path: string; type: string; size?: number }>;
      if (!Array.isArray(data)) continue;

      return data
        .filter((item) => item.type === "file" && item.name.endsWith(".md"))
        .map((item) => ({
          path: item.path,
          isDirectory: false,
          size: item.size,
        }));
    }

    return [];
  }
}
