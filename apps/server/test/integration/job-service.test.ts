import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { setupTestDb, truncateAll, teardownTestDb } from "./helpers/db.js";
import { JobService } from "../../src/services/job-service.js";
import { SourceService } from "../../src/services/source-service.js";
import type { Database } from "../../src/db/database.js";

describe("JobService (integration)", () => {
  let database: Database;
  let jobService: JobService;
  let sourceService: SourceService;

  beforeAll(async () => {
    database = await setupTestDb();
    jobService = new JobService({ database });
    sourceService = new SourceService({ database });
  });

  afterEach(async () => {
    await truncateAll(database);
  });

  afterAll(async () => {
    await teardownTestDb(database);
  });

  async function createSource() {
    const source = await sourceService.createSource({
      name: "Test Source",
      url: "https://example.com/docs",
    });
    if (!source) throw new Error("failed to create source");
    return source;
  }

  it("creates a job and returns the inserted row", async () => {
    const source = await createSource();

    const job = await jobService.createJob({ sourceId: source.id });

    expect(job.id).toBeTruthy();
    expect(job.sourceId).toBe(source.id);
    expect(job.status).toBe("pending");
    expect(job.type).toBe("import");
  });

  it("gets a job by id", async () => {
    const source = await createSource();
    const created = await jobService.createJob({ sourceId: source.id });

    const found = await jobService.getJob(created.id);

    expect(found?.id).toBe(created.id);
  });

  it("returns null when a job does not exist", async () => {
    const found = await jobService.getJob("00000000-0000-0000-0000-000000000000");
    expect(found).toBeNull();
  });

  it("lists jobs ordered by most recent first", async () => {
    const source = await createSource();
    const first = await jobService.createJob({ sourceId: source.id });
    const second = await jobService.createJob({ sourceId: source.id });

    const jobs = await jobService.listJobs();

    expect(jobs.map((j) => j.id)).toEqual([second.id, first.id]);
  });

  it("updates job status from pending to done", async () => {
    const source = await createSource();
    const job = await jobService.createJob({ sourceId: source.id });

    await jobService.updateJobStatus(job.id, "done");

    const updated = await jobService.getJob(job.id);
    expect(updated?.status).toBe("done");
    expect(updated?.finishedAt).toBeTruthy();
  });

  it("counts total jobs", async () => {
    const source = await createSource();
    await jobService.createJob({ sourceId: source.id });
    await jobService.createJob({ sourceId: source.id });

    const count = await jobService.getTotalJobCount();

    expect(count).toBe(2);
  });

  it("computes average import duration across completed jobs", async () => {
    const source = await createSource();
    const jobA = await jobService.createJob({ sourceId: source.id });
    const jobB = await jobService.createJob({ sourceId: source.id });

    await jobService.completeJob(jobA.id, 100);
    await jobService.completeJob(jobB.id, 300);

    const avg = await jobService.getAvgImportDuration();

    expect(avg).toBe(200);
  });
});
