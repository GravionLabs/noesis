export interface SourceDoc {
  id: string;
  url: string;
  title: string | null;
  chunkCount: number;
}

export interface DocChunk {
  id: string;
  docId: string;
  sourceId: string;
  content: string;
  heading: string | null;
  headingPath: string[];
  chunkIndex: number;
  tokenCount: number | null;
  createdAt: string;
}
