import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { MessageService } from 'primeng/api';
import { JobDetail } from './job-detail';
import type { Job } from '../../core/models/job.model';

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
    await TestBed.configureTestingModule({
      imports: [JobDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'j1' }) } },
        },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(JobDetail);
    fixture.detectChanges();
    httpTesting.expectOne('/api/jobs/j1').flush(FAILED_JOB);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the job', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance['job']()).toEqual(FAILED_JOB);
  });

  it('retryJob retries and navigates to /jobs on success', () => {
    const fixture = createComponent();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance['retryJob']();

    const req = httpTesting.expectOne('/api/jobs/j1/retry');
    expect(req.request.method).toBe('POST');
    req.flush({ jobId: 'j2', status: 'accepted' });

    expect(navigateSpy).toHaveBeenCalledWith(['/jobs']);
  });
});
