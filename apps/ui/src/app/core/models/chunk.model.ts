export interface ChunkDetail {
  id: string;
  content: string;
  heading: string | null;
  headingPath: string[];
  chunkIndex: number;
  doc: { url: string; title: string | null };
  source: { id: string; name: string; type: string };
}
