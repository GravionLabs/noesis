import { runImport as jobRunnerRunImport } from "../pipeline/job-runner.js";

export class ImportService {
  async triggerImport(sourceId: string) {
    return jobRunnerRunImport(sourceId);
  }
}

const _shim = new ImportService();

export const triggerImport = _shim.triggerImport.bind(_shim);
