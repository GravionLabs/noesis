import { exec } from "child_process";
import { promisify } from "util";
import { config } from "../../config/index.js";
import { RepositoryProvider, type RepositoryFileInfo, type RepositoryContent } from "./repository-provider.js";

const execAsync = promisify(exec);

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };

  const sshMatch = url.match(/github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

  return null;
}

export class GitHubProvider implements RepositoryProvider {
  name = "github";

  canHandle(url: string): boolean {
    return url.includes("github.com");
  }

  async listFiles(repoUrl: string, path = "", maxDepth = 4): Promise<RepositoryFileInfo[]> {
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) throw new Error(`Invalid GitHub URL: ${repoUrl}`);

    const { owner, repo } = parsed;
    const files: RepositoryFileInfo[] = [];
    const apiPath = path ? path : "";
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${apiPath}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          ...(config.GITHUB_TOKEN && { Authorization: `Bearer ${config.GITHUB_TOKEN}` }),
        },
      });

      if (!response.ok) throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);

      const items = (await response.json()) as Array<{
        name: string;
        path: string;
        type: "file" | "dir";
        size?: number;
      }>;

      for (const item of items) {
        files.push({ path: item.path, isDirectory: item.type === "dir", size: item.size });
      }
    } catch (error) {
      console.error(`Failed to list files from GitHub: ${error}`);
      throw error;
    }

    return files;
  }

  async getFile(repoUrl: string, filePath: string): Promise<RepositoryContent> {
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) throw new Error(`Invalid GitHub URL: ${repoUrl}`);

    const { owner, repo } = parsed;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github.raw",
          ...(config.GITHUB_TOKEN && { Authorization: `Bearer ${config.GITHUB_TOKEN}` }),
        },
      });

      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
      const content = await response.text();
      return { path: filePath, content };
    } catch (error) {
      console.error(`Failed to get file from GitHub: ${error}`);
      throw error;
    }
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
    for (const docDir of ["docs", "doc", "documentation"]) {
      try {
        const files = await this.listFiles(repoUrl, docDir);
        if (files.length > 0) return files.filter((f) => f.path.endsWith(".md"));
      } catch {
        // continue
      }
    }
    return [];
  }
}
