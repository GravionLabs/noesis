import type { Source } from "../models/source.js";

export interface ChunksDroppedEntry {
  reason: string;
  count: number;
}

export interface ImportResult {
  docCount: number;
  chunkCount: number;
  chunksDropped?: ChunksDroppedEntry[];
}

export interface Importer {
  readonly type: string;
  import(source: Source): Promise<ImportResult>;
}

export class ImporterRegistry {
  private registry: Record<string, Importer>;

  constructor({ importers }: { importers: Importer[] }) {
    this.registry = {};
    for (const imp of importers) {
      this.registry[imp.type] = imp;
    }
  }

  getImporter(type: string): Importer | undefined {
    return this.registry[type];
  }
}
