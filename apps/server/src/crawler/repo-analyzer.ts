import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { getProvider } from "./providers/index.js";
import type { RepositoryProvider } from "./providers/index.js";

export interface RepoAnalyzerConfig {
  useEmbeddings?: boolean;
  embeddingModel?: "bge-large-en-v1.5" | "e5-large-v2" | "nomic-embed-text";
  includeStructure?: boolean;
  includeReadme?: boolean;
  includeDocumentation?: boolean;
  includeApis?: boolean;
  maxFileDepth?: number;
  excludePatterns?: string[];
  languages?: string[];
  chunkingStrategy?: "semantic-embeddings" | "by-file";
  cacheEmbeddings?: boolean;
}

export interface RepoAnalysisResult {
  repoUrl: string;
  structure: string;
  readme: string | null;
  documentationFiles: string[];
  apiDefinitions: string;
  llmsTxt: string;
}

export class RepoAnalyzer {
  private provider: RepositoryProvider;
  private config: Required<RepoAnalyzerConfig>;

  constructor(
    private repoUrl: string,
    config: RepoAnalyzerConfig = {},
  ) {
    this.provider = getProvider(repoUrl);
    this.config = this._normalizeConfig(config);
  }

  private _normalizeConfig(config: RepoAnalyzerConfig): Required<RepoAnalyzerConfig> {
    return {
      useEmbeddings: config.useEmbeddings ?? true,
      embeddingModel: config.embeddingModel ?? "bge-large-en-v1.5",
      includeStructure: config.includeStructure ?? true,
      includeReadme: config.includeReadme ?? true,
      includeDocumentation: config.includeDocumentation ?? true,
      includeApis: config.includeApis ?? true,
      maxFileDepth: config.maxFileDepth ?? 4,
      excludePatterns: config.excludePatterns ?? [
        "node_modules",
        "dist",
        "build",
        ".git",
        "test",
        "__pycache__",
      ],
      languages: config.languages ?? ["typescript", "python"],
      chunkingStrategy: config.chunkingStrategy ?? "semantic-embeddings",
      cacheEmbeddings: config.cacheEmbeddings ?? true,
    };
  }

  async analyze(): Promise<RepoAnalysisResult> {
    console.log(`Analyzing repository: ${this.repoUrl}`);

    const structure = await this._buildStructure();
    const readme = await this._getReadme();
    const docFiles = await this._getDocFiles();
    const apiDefinitions = await this._extractApis();
    const llmsTxt = await this._generateLlmsTxt(structure, readme, docFiles, apiDefinitions);

    return { repoUrl: this.repoUrl, structure, readme, documentationFiles: docFiles, apiDefinitions, llmsTxt };
  }

  private async _buildStructure(): Promise<string> {
    if (!this.config.includeStructure) return "";

    console.log("Building repository structure...");
    const files = await this.provider.listFiles(this.repoUrl);
    const lines: string[] = [];
    lines.push("Repository Structure:");
    lines.push("```");

    for (const file of files) {
      if (this._shouldExclude(file.path)) continue;
      const indent = (file.path.match(/\//g) || []).length * 2;
      const name = file.path.split("/").pop();
      const marker = file.isDirectory ? "📁" : "📄";
      lines.push(" ".repeat(indent) + `${marker} ${name}`);
    }

    lines.push("```");
    return lines.join("\n");
  }

  private async _getReadme(): Promise<string | null> {
    if (!this.config.includeReadme) return null;
    console.log("Fetching README...");
    try {
      const readme = await this.provider.getReadme(this.repoUrl);
      if (readme) return readme.content;
    } catch (error) {
      console.error(`Failed to get README: ${error}`);
    }
    return null;
  }

  private async _getDocFiles(): Promise<string[]> {
    if (!this.config.includeDocumentation) return [];
    console.log("Finding documentation files...");
    try {
      const docFiles = await this.provider.getDocFiles(this.repoUrl);
      return docFiles.map((f) => f.path);
    } catch (error) {
      console.error(`Failed to get doc files: ${error}`);
    }
    return [];
  }

  private async _extractApis(): Promise<string> {
    if (!this.config.includeApis) return "";
    console.log("Extracting API definitions...");
    return "## Public APIs\n\n(API extraction coming soon)";
  }

  private async _generateLlmsTxt(
    structure: string,
    readme: string | null,
    docFiles: string[],
    apiDefinitions: string,
  ): Promise<string> {
    const sections: string[] = [];
    sections.push("# Repository Documentation\n");
    sections.push(`**Source:** ${this.repoUrl}\n`);

    if (readme) {
      sections.push("## Overview\n");
      sections.push(readme);
      sections.push("");
    }

    if (structure) {
      sections.push(structure);
      sections.push("");
    }

    if (docFiles.length > 0) {
      sections.push("## Documentation Files\n");
      for (const file of docFiles) sections.push(`- ${file}`);
      sections.push("");
    }

    if (apiDefinitions) sections.push(apiDefinitions);

    return sections.join("\n");
  }

  private _shouldExclude(filePath: string): boolean {
    for (const pattern of this.config.excludePatterns) {
      if (filePath.includes(pattern)) return true;
    }
    return false;
  }
}

export async function analyzeRepository(
  repoUrl: string,
  config: RepoAnalyzerConfig = {},
): Promise<RepoAnalysisResult> {
  const analyzer = new RepoAnalyzer(repoUrl, config);
  return analyzer.analyze();
}
