export interface AggregateStats {
  totalSources: number;
  totalDocs: number;
  totalChunks: number;
  totalEmbeddings: number;
  totalJobs: number;
  avgImportDurationMs: number;
  storageBytes: number;
}

export interface HealthInfo {
  status: string;
  provider: string;
  model: string;
  dimensions: number;
  schedulerRunning: boolean;
  pendingJobs: number;
  totalSources: number;
}
