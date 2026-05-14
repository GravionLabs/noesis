/**
 * Local file system repository provider.
 */

import { promises as fs } from "fs";
import path from "path";
import { RepositoryProvider, RepositoryFileInfo, RepositoryContent } from "./repository-provider.js";

export class LocalProvider implements RepositoryProvider {
  name = "local";

  canHandle(url: string): boolean {
    // Treat relative or absolute paths as local
    return url.startsWith(".") || url.startsWith("/") || !url.includes("://");
  }

  async listFiles(
    repoUrl: string,
    pathSuffix = "",
    maxDepth = 4,
  ): Promise<RepositoryFileInfo[]> {
    const basePath = path.resolve(repoUrl);
    const fullPath = pathSuffix ? path.join(basePath, pathSuffix) : basePath;

    const files: RepositoryFileInfo[] = [];

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files and common non-essential directories
        if (
          entry.name.startsWith(".")
          || ["node_modules", "dist", "build", ".git", "__pycache__"].includes(
            entry.name,
          )
        ) {
          continue;
        }

        const fullEntryPath = path.join(fullPath, entry.name);
        const relativePath = path.relative(basePath, fullEntryPath);

        files.push({
          path: relativePath,
          isDirectory: entry.isDirectory(),
        });
      }
    } catch (error) {
      console.error(`Failed to list files from local path: ${error}`);
      throw error;
    }

    return files;
  }

  async getFile(repoUrl: string, filePath: string): Promise<RepositoryContent> {
    const basePath = path.resolve(repoUrl);
    const fullPath = path.join(basePath, filePath);

    try {
      const content = await fs.readFile(fullPath, "utf-8");
      return { path: filePath, content };
    } catch (error) {
      console.error(`Failed to read file from local path: ${error}`);
      throw error;
    }
  }

  async getReadme(repoUrl: string): Promise<RepositoryContent | null> {
    const basePath = path.resolve(repoUrl);

    for (const name of ["README.md", "readme.md", "README", "readme"]) {
      try {
        const fullPath = path.join(basePath, name);
        const content = await fs.readFile(fullPath, "utf-8");
        return { path: name, content };
      } catch {
        // Continue to next name
      }
    }

    return null;
  }

  async getDocFiles(repoUrl: string): Promise<RepositoryFileInfo[]> {
    const basePath = path.resolve(repoUrl);

    for (const docDir of ["docs", "doc", "documentation"]) {
      try {
        const docPath = path.join(basePath, docDir);
        const entries = await fs.readdir(docPath, { withFileTypes: true });

        return entries
          .filter((e) => !e.isDirectory() && e.name.endsWith(".md"))
          .map((e) => ({
            path: path.join(docDir, e.name),
            isDirectory: false,
          }));
      } catch {
        // Continue to next directory name
      }
    }

    return [];
  }
}
