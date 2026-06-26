import type { SourceService } from "../services/source-service.js";
import type { JobService } from "../services/job-service.js";
import type { ImporterRegistry } from "../importers/registry.js";
import type { EmbeddingService } from "../services/embedding-service.js";
import type { Config } from "../config/index.js";
import { logger as _logger } from "../logger.js";
import { jobEvents } from "./job-events.js";

export class JobRunner {
  private sourceService: SourceService;
  private jobService: JobService;
  private importerRegistry: ImporterRegistry;
  private embeddingService: EmbeddingService;
  private config: Config;
  private log: ReturnType<typeof _logger.child>;

  constructor({
    sourceService,
    jobService,
    importerRegistry,
    embeddingService,
    config,
    logger,
  }: {
    sourceService: SourceService;
    jobService: JobService;
    importerRegistry: ImporterRegistry;
    embeddingService: EmbeddingService;
    config: Config;
    logger: typeof _logger;
  }) {
    this.sourceService = sourceService;
    this.jobService = jobService;
    this.importerRegistry = importerRegistry;
    this.embeddingService = embeddingService;
    this.config = config;
    this.log = logger.child({ module: "job-runner" });
  }

  async runImport(sourceId: string) {
    const existing = await this.jobService.getRunningJob(sourceId);
    if (existing) {
      this.log.warn({ sourceId, existingJobId: existing.id }, "Import already running for source, skipping");
      return existing;
    }

    return this.executeImport(sourceId);
  }

  private async executeImport(sourceId: string, retryCount = 0) {
    const source = await this.sourceService.getSource(sourceId);
    if (!source) throw new Error(`Source ${sourceId} not found`);

    const maxRetries = this.config.MAX_IMPORT_RETRIES;
    const job = await this.jobService.createJob({ type: "import", sourceId, status: "pending", maxRetries });
    const jobId = job.id;
    const startedAt = Date.now();

    this.log.info({ jobId, sourceId, importerType: source.importerType, retryCount }, "Import job started");

    try {
      await this.jobService.updateJobStatus(jobId, "running");
      jobEvents.emit("job", { id: jobId, sourceId, status: "running" });

      const importer = this.importerRegistry.getImporter(source.importerType);
      if (!importer) throw new Error(`Unknown importer type: ${source.importerType}`);

      const result = await importer.import(source);

      this.log.info(
        { jobId, sourceId, chunkCount: result.chunkCount, chunksDropped: result.chunksDropped ?? [] },
        "Import finished, starting embedding",
      );

      if (result.chunkCount > 0) {
        await this.embeddingService.embedUnembeddedChunks(sourceId);
        this.log.debug({ jobId, sourceId }, "Embedding pass complete");
      }

      const durationMs = Date.now() - startedAt;
      const resultJson = result.chunksDropped?.length
        ? JSON.stringify({ chunksDropped: result.chunksDropped })
        : undefined;
      await this.jobService.completeJob(jobId, durationMs, resultJson);
      jobEvents.emit("job", { id: jobId, sourceId, status: "done", durationMs });
      await this.sourceService.updateLastImported(sourceId);
      this.log.info({ jobId, sourceId, durationMs }, "Import job completed successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - startedAt;
      const newRetryCount = retryCount + 1;

      this.log.error({ jobId, sourceId, err: message, retryCount: newRetryCount, maxRetries }, "Import job failed");

      if (newRetryCount <= maxRetries) {
        const backoffMs = Math.min(Math.pow(2, retryCount) * 10_000, 120_000);
        this.log.info({ jobId, sourceId, backoffMs, retryAttempt: newRetryCount }, "Scheduling retry");

        await this.jobService.failJob(jobId, message, durationMs, retryCount);
        jobEvents.emit("job", { id: jobId, sourceId, status: "failed", error: message });

        return new Promise((resolve) => {
          setTimeout(async () => {
            try {
              const retryJob = await this.executeImport(sourceId, newRetryCount);
              resolve(retryJob);
            } catch {
              const final = await this.jobService.getJob(jobId);
              resolve(final ?? { id: jobId, status: "failed" });
            }
          }, backoffMs);
        });
      } else {
        await this.jobService.failJob(jobId, message, durationMs, retryCount);
        jobEvents.emit("job", { id: jobId, sourceId, status: "failed", error: message });
      }
    }

    const final = await this.jobService.getJob(jobId);
    return final ?? { id: jobId, status: "failed" };
  }
}
