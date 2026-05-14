/**
 * GitHub repository provider using GitHub API or `gh` CLI.
 */

import { exec } from "child_process";
import { promisify } from "util";
import { RepositoryProvider, RepositoryFileInfo, RepositoryContent } from "./repository-provider.js";

const execAsync = promisify(exec);

/**
 * Parse GitHub URL to extract owner and repo.
 * Handles both HTTPS and SSH formats:
 * - https://github.com/owner/repo
 * - git@github.com:owner/repo.git
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // HTTPS format
  const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }

  // SSH format
  const sshMatch = url.match(/github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2] };
  }

  return null;
}

export class GitHubProvider implements RepositoryProvider {
  name = "github";

  canHandle(url: string): boolean {
    return url.includes("github.com");
  }

  async listFiles(
    repoUrl: string,
    path = "",
    maxDepth = 4,
  ): Promise<RepositoryFileInfo[]> {
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) throw new Error(`Invalid GitHub URL: ${repoUrl}`);

    const { owner, repo } = parsed;
    const files: RepositoryFileInfo[] = [];

    // Use GitHub API to list repository contents
    const apiPath = path ? `${path}` : "";
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${apiPath}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          ...(process.env.GITHUB_TOKEN && {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          }),
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const items = (await response.json()) as Array<{
        name: string;
        path: string;
        type: "file" | "dir";
        size?: number;
      }>;

      for (const item of items) {
        files.push({
          path: item.path,
          isDirectory: item.type === "dir",
          size: item.size,
        });
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
          ...(process.env.GITHUB_TOKEN && {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          }),
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const content = await response.text();
      return { path: filePath, content };
    } catch (error) {
      console.error(`Failed to get file from GitHub: ${error}`);
      throw error;
    }
  }

  async getReadme(repoUrl: string): Promise<RepositoryContent | null> {
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) throw new Error(`Invalid GitHub URL: ${repoUrl}`);

    const { owner, repo } = parsed;

    // Try common README names
    for (const name of ["README.md", "readme.md", "README", "readme"]) {
      try {
        return await this.getFile(repoUrl, name);
      } catch {
        // Continue to next name
      }
    }

    return null;
  }

  async getDocFiles(repoUrl: string): Promise<RepositoryFileInfo[]> {
    // List files in docs/ or doc/ directory
    for (const docDir of ["docs", "doc", "documentation"]) {
      try {
        const files = await this.listFiles(repoUrl, docDir);
        if (files.length > 0) {
          return files.filter((f) => f.path.endsWith(".md"));
        }
      } catch {
        // Continue to next directory name
      }
    }

    return [];
  }
}
