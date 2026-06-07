import { getSource, updateLastImported } from "../services/source-service.js";
import { createJob, updateJobStatus } from "../services/job-service.js";
import { getImporter } from "../importers/registry.js";
import { embedUnembeddedChunks } from "../services/embedding-service.js";

export async function runImport(sourceId: string) {
  const source = await getSource(sourceId);
  if (!source) throw new Error(`Source ${sourceId} not found`);

  const job = await createJob({ type: "import", sourceId, status: "pending" });
  const jobId = job.id;

  try {
    await updateJobStatus(jobId, "running");

    const importer = getImporter(source.importerType);
    if (!importer) throw new Error(`Unknown importer type: ${source.importerType}`);

    const result = await importer.import(source);

    if (result.chunkCount > 0) {
      await embedUnembeddedChunks(sourceId);
    }

    await updateJobStatus(jobId, "done");
    await updateLastImported(sourceId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateJobStatus(jobId, "failed", message);
  }

  return job;
}
