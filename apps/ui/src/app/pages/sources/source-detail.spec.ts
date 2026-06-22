import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { MessageService } from 'primeng/api';
import { SourceDetail } from './source-detail';
import type { Source, SourceStats } from '../../core/models/source.model';
import type { Job } from '../../core/models/job.model';

const SOURCE: Source = {
  id: 's1',
  name: 'Test Source',
  url: 'https://example.com',
  importerType: 'llmstxt',
  enabled: true,
  config: null,
  schedule: null,
  lastImportedAt: null,
};

const STATS: SourceStats = {
  docCount: 3,
  chunkCount: 42,
  avgTokenCount: 128,
  latestJobStatus: 'done',
  latestJobDurationMs: 1000,
};

const JOBS: Job[] = [
  {
    id: 'j1',
    sourceId: 's1',
    type: 'import',
    status: 'done',
    error: null,
    retryCount: 0,
    maxRetries: 3,
    durationMs: 1000,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'j2',
    sourceId: 's2',
    type: 'import',
    status: 'done',
    error: null,
    retryCount: 0,
    maxRetries: 3,
    durationMs: 1000,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

describe('SourceDetail', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourceDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 's1' }) } },
        },
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(SourceDetail);
    fixture.detectChanges();
    httpTesting.expectOne('/api/sources/s1').flush(SOURCE);
    httpTesting.expectOne('/api/sources/s1/stats').flush(STATS);
    httpTesting.expectOne('/api/jobs').flush(JOBS);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the source and stats', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance['source']()).toEqual(SOURCE);
    expect(fixture.componentInstance['stats']()).toEqual(STATS);
  });

  it('filters job history to this source only', () => {
    const fixture = createComponent();
    const history = fixture.componentInstance['jobHistory']();
    expect(history).toEqual([JOBS[0]]);
  });

  it('importNow triggers import and navigates to /jobs', () => {
    const fixture = createComponent();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance['importNow']();

    const req = httpTesting.expectOne('/api/sources/s1/import');
    req.flush({ jobId: 'j3', status: 'accepted' });

    expect(navigateSpy).toHaveBeenCalledWith(['/jobs']);
  });
});
