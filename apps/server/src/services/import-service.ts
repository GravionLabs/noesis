/**
 * ImportService — thin orchestration layer for triggering imports.
 *
 * Tables: none (delegates entirely to JobRunner)
 * DB access: none direct
 *
 * Key methods:
 *   triggerImport(sourceId) — delegates to jobRunner.runImport(); throws if
 *     source not found or an import is already running for that source
 */
import { JobRunner } from "../pipeline/job-runner.js";

export class ImportService {
  private jobRunner: JobRunner;

  constructor({ jobRunner }: { jobRunner: JobRunner }) {
    this.jobRunner = jobRunner;
  }

  async triggerImport(sourceId: string) {
    return this.jobRunner.runImport(sourceId);
  }
}
