import { query } from "../db/pool.js";
import { chunkMarkdown } from "./chunk-utils.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";
import { AzureDevOpsProvider } from "../crawler/providers/azure-devops-provider.js";

export class AzureDevopsImporter implements Importer {
  readonly type = "azuredevops";
  private provider = new AzureDevOpsProvider();

  async import(source: Source): Promise<ImportResult> {
    if (!this.provider.canHandle(source.url)) {
      throw new Error("Azure DevOps importer requires a dev.azure.com URL");
    }

    let totalDocs = 0;
    let totalChunks = 0;

    const readme = await this.provider.getReadme(source.url);
    if (readme) {
      const chunks = chunkMarkdown(readme.content);
      if (chunks.length > 0) {
        const title = this.extractRepoName(source.url) + " README";
        await this.storeDoc(source.id, readme.path, title, readme.content, chunks);
        totalDocs++;
        totalChunks += chunks.length;
      }
    }

    const docFiles = await this.provider.getDocFiles(source.url);
    for (const file of docFiles) {
      try {
        const content = await this.provider.getFile(source.url, file.path);
        const chunks = chunkMarkdown(content.content);
        if (chunks.length === 0) continue;

        const title = this.extractRepoName(source.url) + file.path.replace(/^.*\/docs\//, "/");
        await this.storeDoc(source.id, source.url + file.path, title, content.content, chunks);
        totalDocs++;
        totalChunks += chunks.length;
      } catch {
        continue;
      }
    }

    return { docCount: totalDocs, chunkCount: totalChunks };
  }

  private extractRepoName(url: string): string {
    const parts = url.replace(/\/$/, "").split("/");
    return parts[parts.length - 1] || url;
  }

  private async storeDoc(
    sourceId: string,
    url: string,
    title: string,
    contentMd: string,
    chunks: Array<{ content: string; heading: string | undefined; headingPath: string[]; chunkIndex: number }>,
  ): Promise<void> {
    const docResult = await query<{ id: string }>(
      `INSERT INTO docs (source_id, url, title, content_md, content_hash)
       VALUES ($1, $2, $3, $4, md5($4))
       ON CONFLICT (source_id, url)
       DO UPDATE SET title = EXCLUDED.title, content_md = EXCLUDED.content_md,
                     content_hash = EXCLUDED.content_hash, indexed_at = now()
       RETURNING id`,
      [sourceId, url, title, contentMd],
    );
    const docId = docResult.rows[0].id;

    for (const chunk of chunks) {
      await query(
        `INSERT INTO chunks (doc_id, source_id, content, heading, heading_path, chunk_index)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [docId, sourceId, chunk.content, chunk.heading, chunk.headingPath, chunk.chunkIndex],
      );
    }
  }
}
