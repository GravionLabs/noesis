/**
 * Repository provider abstraction for multi-platform support.
 */

export interface RepositoryFileInfo {
  path: string;
  isDirectory: boolean;
  size?: number;
  lastModified?: Date;
}

export interface RepositoryContent {
  path: string;
  content: string;
}

/**
 * Abstract provider for different repository platforms.
 */
export abstract class RepositoryProvider {
  abstract name: string;

  /**
   * Detect if a URL/path is valid for this provider.
   */
  abstract canHandle(url: string): boolean;

  /**
   * List all files in repository at given path.
   */
  abstract listFiles(
    repoUrl: string,
    path?: string,
    maxDepth?: number,
  ): Promise<RepositoryFileInfo[]>;

  /**
   * Get file content.
   */
  abstract getFile(repoUrl: string, filePath: string): Promise<RepositoryContent>;

  /**
   * Get README file (markdown).
   */
  abstract getReadme(repoUrl: string): Promise<RepositoryContent | null>;

  /**
   * Get list of documentation files (e.g., from docs/ folder).
   */
  abstract getDocFiles(repoUrl: string): Promise<RepositoryFileInfo[]>;
}
