import { sql } from "drizzle-orm";
import { chunks, docs, sources, embeddings } from "../db/schema.js";
import type { Database } from "../db/database.js";
import type { EmbeddingService } from "./embedding-service.js";
import type { EmbeddingProvider } from "../embedding/index.js";

export interface SearchResult {
  sourceName: string;
  docUrl: string;
  docTitle: string | null;
  heading: string | null;
  content: string;
  score: number;
  chunkId: string;
}

interface SearchResultRow extends Record<string, unknown> {
  chunk_id: string;
  content: string;
  heading: string | null;
  doc_url: string;
  doc_title: string | null;
  source_name: string;
  score: number;
}

interface VectorSearchResultRow extends SearchResultRow {
  vector: number[];
}

interface SearchResultWithVector extends SearchResult {
  vector: number[];
}

function mapRow(r: SearchResultRow): SearchResult {
  return {
    chunkId: r.chunk_id,
    content: r.content,
    heading: r.heading,
    docUrl: r.doc_url,
    docTitle: r.doc_title,
    sourceName: r.source_name,
    score: r.score,
  };
}

const RRF_K = 60;
const MMR_LAMBDA = 0.7;
const HYBRID_FETCH_MULTIPLIER = 3;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export class SearchService {
  private database: Database;
  private embeddingService: EmbeddingService;

  constructor({
    database,
    embeddingService,
  }: {
    database: Database;
    embeddingService: EmbeddingService;
  }) {
    this.database = database;
    this.embeddingService = embeddingService;
  }

  async searchByText(
    searchQuery: string,
    limit = 10,
    sourceName?: string,
  ): Promise<SearchResult[]> {
    const result = await this.database.db.execute<SearchResultRow>(sql`
      SELECT
        c.id          AS chunk_id,
        c.content,
        c.heading,
        d.url         AS doc_url,
        d.title       AS doc_title,
        s.name        AS source_name,
        ts_rank(to_tsvector('english', c.content),
                plainto_tsquery('english', ${searchQuery})) AS score
      FROM ${chunks} c
      JOIN ${docs} d ON d.id = c.doc_id
      JOIN ${sources} s ON s.id = c.source_id
      WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', ${searchQuery})
      ${sourceName ? sql`AND s.name = ${sourceName}` : sql``}
      ORDER BY score DESC
      LIMIT ${limit}
    `);
    return (result.rows as SearchResultRow[]).map(mapRow);
  }

  async searchByVector(
    vector: number[],
    limit = 10,
    sourceName?: string,
  ): Promise<SearchResult[]> {
    const results = await this.searchByVectorInternal(vector, limit, sourceName);
    return results.map(({ vector: _v, ...rest }) => rest);
  }

  private async searchByVectorInternal(
    vector: number[],
    limit = 10,
    sourceName?: string,
  ): Promise<SearchResultWithVector[]> {
    const dims = vector.length;
    const vectorLit = `[${vector.join(",")}]`;

    const result = await this.database.db.execute<VectorSearchResultRow>(sql`
      SELECT
        c.id          AS chunk_id,
        c.content,
        c.heading,
        d.url         AS doc_url,
        d.title       AS doc_title,
        s.name        AS source_name,
        1 - (e.vector <=> ${vectorLit}::vector) AS score,
        e.vector
      FROM ${embeddings} e
      JOIN ${chunks} c ON c.id = e.chunk_id
      JOIN ${docs} d ON d.id = c.doc_id
      JOIN ${sources} s ON s.id = c.source_id
      WHERE e.dimensions = ${dims}
      ${sourceName ? sql`AND s.name = ${sourceName}` : sql``}
      ORDER BY e.vector <=> ${vectorLit}::vector
      LIMIT ${limit}
    `);
    return (result.rows as VectorSearchResultRow[]).map((r) => ({
      ...mapRow(r),
      vector: r.vector,
    }));
  }

  async searchDocs(
    queryText: string,
    limit = 5,
    sourceName?: string,
  ): Promise<SearchResult[]> {
    try {
      const provider: EmbeddingProvider = this.embeddingService.getProvider();
      const vector = await provider.embed([queryText]);
      if (vector[0]?.length) {
        return this.hybridSearch(vector[0], queryText, limit, sourceName);
      }
    } catch {
    }

    return this.searchByText(queryText, limit, sourceName);
  }

  private async hybridSearch(
    queryVector: number[],
    queryText: string,
    limit: number,
    sourceName?: string,
  ): Promise<SearchResult[]> {
    const fetchLimit = Math.max(limit, Math.ceil(limit * HYBRID_FETCH_MULTIPLIER));

    const [vectorResults, textResults] = await Promise.all([
      this.searchByVectorInternal(queryVector, fetchLimit, sourceName),
      this.searchByText(queryText, fetchLimit, sourceName),
    ]);

    const vectorMap = new Map(vectorResults.map((r) => [r.chunkId, r.vector]));

    const merged = this.rrfMerge(
      vectorResults.map(({ vector: _v, ...rest }) => rest),
      textResults,
    );

    return this.mmrDiversity(merged, limit, vectorMap);
  }

  private rrfMerge(
    vectorResults: SearchResult[],
    textResults: SearchResult[],
  ): SearchResult[] {
    const scores = new Map<
      string,
      { result: SearchResult; rankV: number | null; rankT: number | null }
    >();

    for (let i = 0; i < vectorResults.length; i++) {
      scores.set(vectorResults[i].chunkId, {
        result: vectorResults[i],
        rankV: i,
        rankT: null,
      });
    }

    for (let i = 0; i < textResults.length; i++) {
      const r = textResults[i];
      const existing = scores.get(r.chunkId);
      if (existing) {
        existing.rankT = i;
      } else {
        scores.set(r.chunkId, { result: r, rankV: null, rankT: i });
      }
    }

    const entries = Array.from(scores.values());
    for (const entry of entries) {
      let rrfScore = 0;
      if (entry.rankV !== null) {
        rrfScore += 1 / (RRF_K + entry.rankV + 1);
      }
      if (entry.rankT !== null) {
        rrfScore += 1 / (RRF_K + entry.rankT + 1);
      }
      entry.result.score = rrfScore;
    }

    entries.sort((a, b) => b.result.score - a.result.score);
    return entries.map((e) => e.result);
  }

  private mmrDiversity(
    results: SearchResult[],
    limit: number,
    vectorMap: Map<string, number[]>,
  ): SearchResult[] {
    if (results.length === 0 || limit === 0) return [];

    const maxScore = results[0].score || 1;
    const selected: SearchResult[] = [];
    const candidates: { result: SearchResult; normRelevance: number }[] =
      results.map((r) => ({
        result: r,
        normRelevance: r.score / maxScore,
      }));

    while (selected.length < limit && candidates.length > 0) {
      let bestIdx = -1;
      let bestMMR = -Infinity;

      for (let i = 0; i < candidates.length; i++) {
        const { result, normRelevance } = candidates[i];

        let maxSim = 0;
        const candVec = vectorMap.get(result.chunkId);
        if (candVec) {
          for (const sel of selected) {
            const selVec = vectorMap.get(sel.chunkId);
            if (selVec) {
              maxSim = Math.max(maxSim, cosineSimilarity(candVec, selVec));
            }
          }
        }

        const mmr = MMR_LAMBDA * normRelevance - (1 - MMR_LAMBDA) * maxSim;
        if (mmr > bestMMR) {
          bestMMR = mmr;
          bestIdx = i;
        }
      }

      if (bestIdx === -1) break;
      selected.push(candidates[bestIdx].result);
      candidates.splice(bestIdx, 1);
    }

    return selected;
  }
}
