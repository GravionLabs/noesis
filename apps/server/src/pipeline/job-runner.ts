import { getSource, updateLastImported } from "../services/source-service.js";
import {
  createJob,
  getJob,
  getRunningJob,
  updateJobStatus,
  completeJob,
  failJob,
} from "../services/job-service.js";
import { getImporter } from "../importers/registry.js";
import { embedUnembeddedChunks } from "../services/embedding-service.js";
import { logger as _logger } from "../logger.js";
import { config as _config } from "../config.js";

const _log = _logger.child({ module: "job-runner" });

export class JobRunner {
  private sourceService: {
    getSource: Function;
    updateLastImported: Function;
  };
  private jobService: {
    createJob: Function;
    getJob: Function;
    getRunningJob: Function;
    updateJobStatus: Function;
    completeJob: Function;
    failJob: Function;
  };
  private importerRegistry: { getImporter: Function };
  private embeddingService: { embedUnembeddedChunks: Function };
  private config: { MAX_IMPORT_RETRIES: number };
  private log: ReturnType<typeof _logger.child>;

  constructor(opts?: {
    sourceService?: { getSource: Function; updateLastImported: Function };
    jobService?: {
      createJob: Function;
      getJob: Function;
      getRunningJob: Function;
      updateJobStatus: Function;
      completeJob: Function;
      failJob: Function;
    };
    importerRegistry?: { getImporter: Function };
    embeddingService?: { embedUnembeddedChunks: Function };
    config?: { MAX_IMPORT_RETRIES: number };
    logger?: { child: Function };
  }) {
    this.sourceService = opts?.sourceService ?? { getSource, updateLastImported };
    this.jobService = opts?.jobService ?? {
      createJob,
      getJob,
      getRunningJob,
      updateJobStatus,
      completeJob,
      failJob,
    };
    this.importerRegistry = opts?.importerRegistry ?? { getImporter };
    this.embeddingService = opts?.embeddingService ?? { embedUnembeddedChunks };
    this.config = opts?.config ?? _config;
    const l = opts?.logger ?? _logger;
    this.log = l.child({ module: "job-runner" });
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

      const importer = this.importerRegistry.getImporter(source.importerType);
      if (!importer) throw new Error(`Unknown importer type: ${source.importerType}`);

      const result = await importer.import(source);

      this.log.info({ jobId, sourceId, chunkCount: result.chunkCount }, "Import finished, starting embedding");

      if (result.chunkCount > 0) {
        await this.embeddingService.embedUnembeddedChunks(sourceId);
        this.log.debug({ jobId, sourceId }, "Embedding pass complete");
      }

      const durationMs = Date.now() - startedAt;
      await this.jobService.completeJob(jobId, durationMs);
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
      }
    }

    const final = await this.jobService.getJob(jobId);
    return final ?? { id: jobId, status: "failed" };
  }
}

const _default = new JobRunner();
export const runImport = _default.runImport.bind(_default);
