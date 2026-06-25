import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { JobsList } from './jobs-list';
import { JobsStore } from '../../core/stores/jobs.store';
import type { Job } from '../../core/models/job.model';

const PENDING_JOB: Job = {
  id: 'j1',
  sourceId: 's1',
  type: 'import',
  status: 'pending',
  error: null,
  retryCount: 0,
  maxRetries: 3,
  durationMs: null,
  startedAt: null,
  finishedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
};

const FAILED_JOB: Job = {
  id: 'j2',
  sourceId: 's2',
  type: 'import',
  status: 'failed',
  error: 'boom',
  retryCount: 1,
  maxRetries: 3,
  durationMs: 500,
  startedAt: null,
  finishedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
};

/** Minimal EventSource fake that records listeners and exposes a fire() helper. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  private listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  close = vi.fn();

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(cb);
  }

  fire(type: string, data: unknown) {
    this.listeners[type]?.forEach((cb) =>
      cb(new MessageEvent(type, { data: JSON.stringify(data) })),
    );
  }
}

describe('JobsList', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);

    await TestBed.configureTestingModule({
      imports: [JobsList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.inject(JobsStore).disconnectSse();
    httpTesting.verify();
    vi.unstubAllGlobals();
  });

  function createComponent(jobs: Job[]) {
    const fixture = TestBed.createComponent(JobsList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/jobs').flush(jobs);
    httpTesting.expectOne('/api/sources').flush([]);
    fixture.detectChanges();
    return fixture;
  }

  it('loads jobs on init', () => {
    const fixture = createComponent([PENDING_JOB, FAILED_JOB]);
    expect(fixture.componentInstance['store'].jobs()).toEqual([PENDING_JOB, FAILED_JOB]);
  });

  it('resolves source names for jobs, falling back to the id when unknown', () => {
    const fixture = TestBed.createComponent(JobsList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/jobs').flush([PENDING_JOB, FAILED_JOB]);
    httpTesting
      .expectOne('/api/sources')
      .flush([
        { id: 's1', name: 'Docs', url: 'https://example.com', importerType: 'llmstxt', enabled: true, config: null, schedule: null, lastImportedAt: null },
      ]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component['sourceName']('s1')).toBe('Docs');
    expect(component['sourceName']('s2')).toBe('s2');
  });

  it('filters jobs by status', () => {
    const fixture = createComponent([PENDING_JOB, FAILED_JOB]);
    const component = fixture.componentInstance;

    component['setFilter']('failed');
    expect(component['filteredJobs']()).toEqual([FAILED_JOB]);

    component['setFilter']('all');
    expect(component['filteredJobs']()).toEqual([PENDING_JOB, FAILED_JOB]);
  });

  it('opens an SSE stream on init', () => {
    const store = TestBed.inject(JobsStore);
    const connectSpy = vi.spyOn(store, 'connectSse');

    createComponent([]);

    expect(connectSpy).toHaveBeenCalledOnce();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toContain('/api/jobs/stream');
  });

  it('updates a job in real time when the SSE stream emits', () => {
    const fixture = createComponent([PENDING_JOB]);
    const store = fixture.componentInstance['store'];

    // Simulate the SSE stream pushing a status update for j1
    const updatedJob = { id: 'j1', status: 'done' };
    FakeEventSource.instances[0].fire('message', updatedJob);
    fixture.detectChanges();

    expect(store.jobs().find((j) => j.id === 'j1')?.status).toBe('done');
  });

  it('closes the SSE stream when the component is destroyed', () => {
    const fixture = createComponent([]);
    const es = FakeEventSource.instances[0];

    fixture.destroy();

    expect(es.close).toHaveBeenCalledOnce();
  });

  it('retryJob retries via the store and shows a success toast', () => {
    const fixture = createComponent([FAILED_JOB]);
    const component = fixture.componentInstance;
    const store = component['store'];
    const retrySpy = vi.spyOn(store, 'retryJob');

    component['retryJob'](FAILED_JOB);

    expect(retrySpy).toHaveBeenCalledWith('j2');
    const req = httpTesting.expectOne('/api/jobs/j2/retry');
    req.flush({ jobId: 'j3', status: 'accepted' });
    httpTesting.expectOne('/api/jobs').flush([]);
  });
});
