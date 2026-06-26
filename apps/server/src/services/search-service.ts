/**
 * SearchService — full-text and vector similarity search.
 *
 * Tables (read): chunks, docs, sources, embeddings
 * DB access: db.execute(sql``) tagged template — Postgres-specific operators
 *   (to_tsvector/ts_rank/@@ for FTS; <=> cosine distance for pgvector) have
 *   no Drizzle ORM equivalent and require raw SQL. The sql`` tagged template
 *   provides parameter safety and keeps table references in sync with schema.
 * Fallback: searchDocs() tries vector search first; falls back to FTS if the
 *   embedding provider fails or returns no vector.
 */
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
    const dims = vector.length;
    const vectorLit = `[${vector.join(",")}]`;

    const result = await this.database.db.execute<SearchResultRow>(sql`
      SELECT
        c.id          AS chunk_id,
        c.content,
        c.heading,
        d.url         AS doc_url,
        d.title       AS doc_title,
        s.name        AS source_name,
        1 - (e.vector <=> ${vectorLit}::vector) AS score
      FROM ${embeddings} e
      JOIN ${chunks} c ON c.id = e.chunk_id
      JOIN ${docs} d ON d.id = c.doc_id
      JOIN ${sources} s ON s.id = c.source_id
      WHERE e.dimensions = ${dims}
      ${sourceName ? sql`AND s.name = ${sourceName}` : sql``}
      ORDER BY e.vector <=> ${vectorLit}::vector
      LIMIT ${limit}
    `);
    return (result.rows as SearchResultRow[]).map(mapRow);
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
        return this.searchByVector(vector[0], limit, sourceName);
      }
    } catch {
    }

    return this.searchByText(queryText, limit, sourceName);
  }
}
