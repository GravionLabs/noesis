import { runImport } from "../pipeline/job-runner.js";

export async function triggerImport(sourceId: string) {
  return runImport(sourceId);
}
