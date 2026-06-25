import { EventEmitter } from "node:events";

export interface JobStatusEvent {
  id: string;
  sourceId: string | null;
  status: "running" | "done" | "failed";
  durationMs?: number;
  error?: string;
}

/**
 * Singleton in-process event emitter for job status changes.
 *
 * NOTE: This only works for a single server instance. In a horizontally
 * scaled deployment, a shared pub/sub mechanism (e.g. Redis Pub/Sub or
 * Postgres LISTEN/NOTIFY) would be needed instead.
 */
export const jobEvents = new EventEmitter();

// Suppress Node.js default MaxListenersExceededWarning when many browser
// tabs hold open SSE connections simultaneously.
jobEvents.setMaxListeners(100);
