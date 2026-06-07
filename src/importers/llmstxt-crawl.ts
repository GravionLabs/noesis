import { config } from "../config.js";
import type { Importer, ImportResult } from "./registry.js";
import type { Source } from "../models/source.js";

export class LlmsTxtCrawlImporter implements Importer {
  readonly type = "llmstxt-crawl";

  async import(source: Source): Promise<ImportResult> {
    const includeOptional = this.parseOptional(source.config);
    const url = `${config.CRAWLER_URL}/jobs/crawl-llmstxt`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: crypto.randomUUID(),
        sourceId: source.id,
        url: source.url,
        includeOptional,
      }),
    });

    if (!res.ok) throw new Error(`Crawler returned ${res.status}`);
    const body = (await res.json()) as { jobId: string; status: string };

    const result = await this.pollForChunks(body.jobId, source.id);
    return result;
  }

  private async pollForChunks(
    _jobId: string,
    sourceId: string,
    maxAttempts = 60,
  ): Promise<ImportResult> {
    const { query } = await import("../db/pool.js");

    for (let i = 0; i < maxAttempts; i++) {
      const count = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM chunks WHERE source_id = $1`,
        [sourceId],
      );
      const chunkCount = parseInt(count.rows[0]?.count ?? "0", 10);
      if (chunkCount > 0) return { docCount: 1, chunkCount };

      await new Promise((r) => setTimeout(r, 2000));
    }

    throw new Error("Crawler job timed out");
  }

  private parseOptional(configStr: string | null): boolean {
    if (!configStr) return false;
    try {
      return JSON.parse(configStr).includeOptional ?? false;
    } catch {
      return false;
    }
  }
}
