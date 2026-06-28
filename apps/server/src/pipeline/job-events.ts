import { EventEmitter } from "node:events";

export interface JobStatusEvent {
  id: string;
  sourceId: string | null;
  status: "running" | "done" | "failed" | "cancelled";
  durationMs?: number;
  error?: string;
}

export interface JobLogEvent {
  id: string;
  jobId: string;
  message: string;
  level: string;
  createdAt: string;
}

/**
 * Singleton in-process event emitter for job status changes and log entries.
 *
 * NOTE: This only works for a single server instance. In a horizontally
 * scaled deployment, a shared pub/sub mechanism (e.g. Redis Pub/Sub or
 * Postgres LISTEN/NOTIFY) would be needed instead.
 */
export const jobEvents = new EventEmitter();

// Suppress Node.js default MaxListenersExceededWarning when many browser
// tabs hold open SSE connections simultaneously.
jobEvents.setMaxListeners(100);
