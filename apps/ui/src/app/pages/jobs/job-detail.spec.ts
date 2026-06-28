import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { JobDetail } from './job-detail';
import { JobsStore } from '../../core/stores/jobs.store';
import type { Job } from '../../core/models/job.model';

/** Minimal EventSource stub — jsdom does not provide EventSource. */
class FakeEventSource {
  readonly url: string;
  constructor(url: string) { this.url = url; }
  addEventListener() { /* noop */ }
  close() { /* noop */ }
}

const FAILED_JOB: Job = {
  id: 'j1',
  sourceId: 's1',
  type: 'import',
  status: 'failed',
  error: 'something broke',
  retryCount: 1,
  maxRetries: 3,
  durationMs: 1500,
  startedAt: '2026-01-01T00:00:00Z',
  finishedAt: '2026-01-01T00:00:01Z',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('JobDetail', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    vi.stubGlobal('EventSource', FakeEventSource);

    await TestBed.configureTestingModule({
      imports: [JobDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        ConfirmationService,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'j1' }) } },
        },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    httpTesting.verify();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(JobDetail);
    fixture.detectChanges();
    // JobsStore.loadJobs() → listJobs
    httpTesting.expectOne('/api/jobs').flush([FAILED_JOB]);
    httpTesting.expectOne('/api/sources').flush([]);
    fixture.detectChanges();
    // JobLogsComponent fetches logs on init
    httpTesting.expectOne('/api/jobs/j1/logs').flush([]);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the job', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance['liveJob']()).toEqual(FAILED_JOB);
  });

  it('resolves the source name, falling back to the id when unknown', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance['sourceName']('s1')).toBe('s1');
  });

  it('retryJob retries and navigates to job detail on success', () => {
    const fixture = createComponent();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance['retryJob']();

    const req = httpTesting.expectOne('/api/jobs/j1/retry');
    expect(req.request.method).toBe('POST');
    req.flush({ jobId: 'j2', status: 'accepted' });

    expect(navigateSpy).toHaveBeenCalledWith(['/jobs', 'j2']);
  });

  it('confirmDelete shows a confirmation dialog then deletes and navigates to /jobs', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');
    const confirmationService = TestBed.inject(ConfirmationService);
    const confirmSpy = vi.spyOn(confirmationService, 'confirm');

    component['confirmDelete']();

    expect(confirmSpy).toHaveBeenCalledOnce();
    const config = confirmSpy.mock.calls[0][0];

    // Accept the confirmation
    config.accept?.();
    const req = httpTesting.expectOne('/api/jobs/j1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(navigateSpy).toHaveBeenCalledWith(['/jobs']);
  });
});
