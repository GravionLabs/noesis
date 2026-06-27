export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  health(): Promise<boolean>;
  readonly model: string;
  readonly dimensions: number;
}
