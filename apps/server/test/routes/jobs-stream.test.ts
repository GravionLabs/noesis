import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify from "fastify";
import http from "node:http";
import { jobEvents } from "../../src/pipeline/job-events.js";

const mockListJobs = vi.fn();
const mockGetJob = vi.fn();
const mockTriggerImport = vi.fn();
const mockCancelJob = vi.fn();

import { registerJobRoutes } from "../../src/routes/jobs.js";

describe("GET /api/jobs/stream", () => {
  const buildApp = async () => {
    const app = Fastify();
    await app.register(import("@fastify/swagger"), {
      openapi: { info: { title: "Test", version: "1.0.0" } },
    });
    registerJobRoutes(app, {
      jobService: { listJobs: mockListJobs, getJob: mockGetJob } as any,
      importService: { triggerImport: mockTriggerImport } as any,
      jobRunner: { cancelJob: mockCancelJob } as any,
    });
    return app;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Opens a real HTTP connection to the SSE endpoint, collects the first data
   * frame(s) containing the emitted event, then destroys the socket.
   */
  function collectSseChunks(port: number, durationMs = 200): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = "";
      const req = http.get(`http://127.0.0.1:${port}/api/jobs/stream`, (res) => {
        res.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on("end", () => resolve(body));
        res.on("error", reject);
      });
      req.on("error", reject);

      // Abort the connection after durationMs — the SSE stream stays open
      // indefinitely, so we must destroy it to get a result.
      setTimeout(() => {
        req.destroy();
        resolve(body);
      }, durationMs);
    });
  }

  it("returns SSE headers and emits a job event", async () => {
    const app = await buildApp();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const port = (app.server.address() as any).port as number;

    const event = { id: "job-1", sourceId: "src-1", status: "running" as const };

    // Start collecting chunks; after a short delay emit the event
    const chunksPromise = collectSseChunks(port, 150);
    await new Promise((r) => setTimeout(r, 30));
    jobEvents.emit("job", event);

    const body = await chunksPromise;
    await app.close();

    expect(body).toContain(`data: ${JSON.stringify(event)}`);
  });

  it("does not throw when an event fires with no active connections", async () => {
    const app = await buildApp();
    mockListJobs.mockResolvedValue([]);

    const listRes = await app.inject({ method: "GET", url: "/api/jobs" });
    expect(listRes.statusCode).toBe(200);

    expect(() =>
      jobEvents.emit("job", { id: "x", sourceId: null, status: "done" as const }),
    ).not.toThrow();

    await app.close();
  });

  it("cleans up the listener when the client disconnects", async () => {
    const app = await buildApp();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const port = (app.server.address() as any).port as number;

    const listenerCountBefore = jobEvents.listenerCount("job");

    // Open and immediately close the SSE connection
    await collectSseChunks(port, 50);

    // Give the 'close' event a tick to propagate and remove the listener
    await new Promise((r) => setTimeout(r, 30));

    const listenerCountAfter = jobEvents.listenerCount("job");
    await app.close();

    expect(listenerCountAfter).toBe(listenerCountBefore);
  });
});
