export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export interface JobLogEntry {
  t: string;
  m: string;
}

export interface Job {
  id: string;
  sourceId: string | null;
  type: string;
  status: JobStatus;
  error: string | null;
  retryCount: number;
  maxRetries: number;
  durationMs: number | null;
  logs: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}
