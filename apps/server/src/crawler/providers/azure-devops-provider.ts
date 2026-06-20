import { RepositoryProvider, type RepositoryFileInfo, type RepositoryContent } from "./repository-provider.js";

function parseAzureDevOpsUrl(url: string): { org: string; project: string; repo: string } | null {
  const match = url.match(/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)/);
  if (match) return { org: match[1], project: match[2], repo: match[3] };
  return null;
}

export class AzureDevOpsProvider implements RepositoryProvider {
  name = "azure-devops";

  canHandle(url: string): boolean {
    return url.includes("dev.azure.com");
  }

  async listFiles(repoUrl: string, path = "", maxDepth = 4): Promise<RepositoryFileInfo[]> {
    const parsed = parseAzureDevOpsUrl(repoUrl);
    if (!parsed) throw new Error(`Invalid Azure DevOps URL: ${repoUrl}`);

    const { org, project, repo } = parsed;
    const files: RepositoryFileInfo[] = [];
    const apiUrl = `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repo}/items?path=${encodeURIComponent(path || "/")}&recursionLevel=OneLevel&api-version=7.0`;

    try {
      const auth = process.env.AZURE_DEVOPS_TOKEN
        ? "Basic " + Buffer.from(`:${process.env.AZURE_DEVOPS_TOKEN}`).toString("base64")
        : undefined;

      const response = await fetch(apiUrl, {
        headers: { ...(auth && { Authorization: auth }) },
      });

      if (!response.ok) throw new Error(`Azure Repos API error: ${response.status} ${response.statusText}`);

      const data = (await response.json()) as {
        value?: Array<{ path: string; isFolder: boolean; size?: number }>;
      };
      const items = data.value || [];

      for (const item of items) {
        files.push({ path: item.path, isDirectory: item.isFolder, size: item.size });
      }
    } catch (error) {
      console.error(`Failed to list files from Azure Repos: ${error}`);
      throw error;
    }

    return files;
  }

  async getFile(repoUrl: string, filePath: string): Promise<RepositoryContent> {
    const parsed = parseAzureDevOpsUrl(repoUrl);
    if (!parsed) throw new Error(`Invalid Azure DevOps URL: ${repoUrl}`);

    const { org, project, repo } = parsed;
    const apiUrl = `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repo}/items?path=${encodeURIComponent(filePath)}&api-version=7.0`;

    try {
      const auth = process.env.AZURE_DEVOPS_TOKEN
        ? "Basic " + Buffer.from(`:${process.env.AZURE_DEVOPS_TOKEN}`).toString("base64")
        : undefined;

      const response = await fetch(apiUrl, {
        headers: { ...(auth && { Authorization: auth }) },
      });

      if (!response.ok) throw new Error(`Azure Repos API error: ${response.status}`);
      const content = await response.text();
      return { path: filePath, content };
    } catch (error) {
      console.error(`Failed to get file from Azure Repos: ${error}`);
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
