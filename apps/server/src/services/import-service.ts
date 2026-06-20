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
