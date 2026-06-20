export interface Source {
  id: string;
  name: string;
  url: string;
  importerType: string;
  enabled: boolean;
  config: string | null;
  schedule: string | null;
  lastImportedAt: string | null;
}

export interface SourceStats {
  docCount: number;
  chunkCount: number;
  avgTokenCount: number | null;
  latestJobStatus: string | null;
  latestJobDurationMs: number | null;
}

export interface CreateSourceDto {
  name: string;
  url: string;
  importerType?: string;
  config?: string;
  schedule?: string;
}

export interface UpdateSourceDto {
  name?: string;
  url?: string;
  importerType?: string;
  enabled?: boolean;
  config?: string | null;
  schedule?: string | null;
}
