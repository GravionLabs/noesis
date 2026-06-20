export interface SearchResult {
  chunkId: string;
  sourceName: string;
  docTitle: string | null;
  docUrl: string;
  heading: string | null;
  content: string;
  score: number;
}

export interface SearchParams {
  q: string;
  source?: string;
  limit?: number;
}
