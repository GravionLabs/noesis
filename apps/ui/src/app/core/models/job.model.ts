export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface Job {
  id: string;
  sourceId: string | null;
  type: string;
  status: JobStatus;
  error: string | null;
  retryCount: number;
  maxRetries: number;
  durationMs: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}
