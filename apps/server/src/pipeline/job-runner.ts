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
import { logger } from "../logger.js";
import { config } from "../config.js";

const log = logger.child({ module: "job-runner" });

async function executeImport(sourceId: string, retryCount = 0): Promise<{ id: string; status: string }> {
  const source = await getSource(sourceId);
  if (!source) throw new Error(`Source ${sourceId} not found`);

  const maxRetries = config.MAX_IMPORT_RETRIES;
  const job = await createJob({ type: "import", sourceId, status: "pending", maxRetries });
  const jobId = job.id;
  const startedAt = Date.now();

  log.info({ jobId, sourceId, importerType: source.importerType, retryCount }, "Import job started");

  try {
    await updateJobStatus(jobId, "running");

    const importer = getImporter(source.importerType);
    if (!importer) throw new Error(`Unknown importer type: ${source.importerType}`);

    const result = await importer.import(source);

    log.info({ jobId, sourceId, chunkCount: result.chunkCount }, "Import finished, starting embedding");

    if (result.chunkCount > 0) {
      await embedUnembeddedChunks(sourceId);
      log.debug({ jobId, sourceId }, "Embedding pass complete");
    }

    const durationMs = Date.now() - startedAt;
    await completeJob(jobId, durationMs);
    await updateLastImported(sourceId);
    log.info({ jobId, sourceId, durationMs }, "Import job completed successfully");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startedAt;
    const newRetryCount = retryCount + 1;

    log.error({ jobId, sourceId, err: message, retryCount: newRetryCount, maxRetries }, "Import job failed");

    if (newRetryCount <= maxRetries) {
      const backoffMs = Math.min(Math.pow(2, retryCount) * 10_000, 120_000);
      log.info({ jobId, sourceId, backoffMs, retryAttempt: newRetryCount }, "Scheduling retry");

      await failJob(jobId, message, durationMs, retryCount);

      return new Promise((resolve) => {
        setTimeout(async () => {
          try {
            const retryJob = await executeImport(sourceId, newRetryCount);
            resolve(retryJob);
          } catch {
            const final = await getJob(jobId);
            resolve(final ?? { id: jobId, status: "failed" });
          }
        }, backoffMs);
      });
    } else {
      await failJob(jobId, message, durationMs, retryCount);
    }
  }

  const final = await getJob(jobId);
  return final ?? { id: jobId, status: "failed" };
}

export async function runImport(sourceId: string) {
  const existing = await getRunningJob(sourceId);
  if (existing) {
    log.warn({ sourceId, existingJobId: existing.id }, "Import already running for source, skipping");
    return existing;
  }

  return executeImport(sourceId);
}
