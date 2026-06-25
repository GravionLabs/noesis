import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import type { Type } from '@angular/core';
import { HelixEmpty, helixBreadcrumbsFromRoutes } from '@gravionlabs/helix';
import { MessageService, ConfirmationService } from 'primeng/api';
import { routes } from './app.routes';
import { Dashboard } from './pages/dashboard/dashboard';
import { SourcesList } from './pages/sources/sources-list';
import { SourceDetail } from './pages/sources/source-detail';
import { JobsList } from './pages/jobs/jobs-list';
import { JobDetail } from './pages/jobs/job-detail';
import { Query } from './pages/query/query';

/** Minimal EventSource stub — jsdom does not provide EventSource. */
class FakeEventSource {
  close = vi.fn();
  addEventListener = vi.fn();
}

describe('routes / breadcrumbs', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    vi.stubGlobal('EventSource', FakeEventSource);

    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        ConfirmationService,
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function breadcrumbLabelsFor(route: ActivatedRoute): unknown[] {
    return helixBreadcrumbsFromRoutes(route).map((item) => item.label);
  }

  function activatedComponent<T>(harness: RouterTestingHarness, type: Type<T>): T {
    return harness.fixture.debugElement.query(By.directive(type)).componentInstance as T;
  }

  it('/ activates the Dashboard with the "Dashboard" breadcrumb', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(activatedComponent(harness, Dashboard)).toBeTruthy();
    expect(breadcrumbLabelsFor(TestBed.inject(ActivatedRoute))).toEqual(['Dashboard']);
  });

  it('/query activates Query with "Knowledge Base > Query"', async () => {
    const harness = await RouterTestingHarness.create('/query');
    httpTesting.expectOne('/api/sources').flush([]);
    expect(activatedComponent(harness, Query)).toBeTruthy();
    expect(breadcrumbLabelsFor(TestBed.inject(ActivatedRoute))).toEqual([
      'Knowledge Base',
      'Query',
    ]);
  });

  it('/jobs activates JobsList with "Knowledge Base > Jobs"', async () => {
    const harness = await RouterTestingHarness.create('/jobs');
    httpTesting.expectOne('/api/jobs').flush([]);
    httpTesting.expectOne('/api/sources').flush([]);
    expect(activatedComponent(harness, JobsList)).toBeTruthy();
    expect(breadcrumbLabelsFor(TestBed.inject(ActivatedRoute))).toEqual([
      'Knowledge Base',
      'Jobs',
    ]);
  });

  it('/jobs/:id activates JobDetail with "Knowledge Base > Jobs > Details"', async () => {
    const harness = await RouterTestingHarness.create('/jobs/j1');
    httpTesting.expectOne('/api/jobs/j1').flush({
      id: 'j1',
      sourceId: null,
      type: 'import',
      status: 'done',
      error: null,
      retryCount: 0,
      maxRetries: 3,
      durationMs: 1000,
      startedAt: null,
      finishedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
    });

    expect(activatedComponent(harness, JobDetail)).toBeTruthy();
    expect(breadcrumbLabelsFor(TestBed.inject(ActivatedRoute))).toEqual([
      'Knowledge Base',
      'Jobs',
      'Details',
    ]);
  });

  it('/settings shows no breadcrumb trail (single segment)', async () => {
    const harness = await RouterTestingHarness.create('/settings');
    expect(activatedComponent(harness, HelixEmpty)).toBeTruthy();
    expect(breadcrumbLabelsFor(TestBed.inject(ActivatedRoute))).toEqual(['Settings']);
  });

  it('/sources activates SourcesList with "Knowledge Base > Sources"', async () => {
    const harness = await RouterTestingHarness.create('/sources');
    httpTesting.expectOne('/api/sources').flush([]);
    expect(activatedComponent(harness, SourcesList)).toBeTruthy();
    expect(breadcrumbLabelsFor(TestBed.inject(ActivatedRoute))).toEqual([
      'Knowledge Base',
      'Sources',
    ]);
  });

  it('/sources/:id activates SourceDetail with "Knowledge Base > Sources > Details"', async () => {
    const harness = await RouterTestingHarness.create('/sources/s1');
    httpTesting.expectOne('/api/sources/s1').flush({
      id: 's1',
      name: 'Test',
      url: 'https://example.com',
      importerType: 'llmstxt',
      enabled: true,
      config: null,
      schedule: null,
      lastImportedAt: null,
    });
    httpTesting.expectOne('/api/sources/s1/stats').flush({
      docCount: 0,
      chunkCount: 0,
      avgTokenCount: null,
      latestJobStatus: null,
      latestJobDurationMs: null,
    });
    httpTesting.expectOne('/api/jobs').flush([]);

    expect(activatedComponent(harness, SourceDetail)).toBeTruthy();
    expect(breadcrumbLabelsFor(TestBed.inject(ActivatedRoute))).toEqual([
      'Knowledge Base',
      'Sources',
      'Details',
    ]);
  });
});
