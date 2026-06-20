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

export abstract class RepositoryProvider {
  abstract name: string;
  abstract canHandle(url: string): boolean;
  abstract listFiles(repoUrl: string, path?: string, maxDepth?: number): Promise<RepositoryFileInfo[]>;
  abstract getFile(repoUrl: string, filePath: string): Promise<RepositoryContent>;
  abstract getReadme(repoUrl: string): Promise<RepositoryContent | null>;
  abstract getDocFiles(repoUrl: string): Promise<RepositoryFileInfo[]>;
}
