import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { StatsWidget } from './stats-widget';

describe('StatsWidget', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsWidget],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('populates all tiles when both requests succeed', () => {
    const fixture = TestBed.createComponent(StatsWidget);
    fixture.detectChanges();

    httpTesting.expectOne('/api/stats').flush({ totalSources: 3, totalDocs: 10, totalChunks: 42 });
    httpTesting.expectOne('/healthz/ready').flush({
      status: 'ok',
      pendingJobs: 2,
      totalSources: 3,
      provider: 'local',
      model: 'test',
      dimensions: 768,
      schedulerRunning: true,
    });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component['loading']()).toBe(false);
    expect(component['stats']()?.totalSources).toBe(3);
    expect(component['health']()?.pendingJobs).toBe(2);
  });

  it('still populates stats tiles when /healthz/ready fails (partial failure)', () => {
    const fixture = TestBed.createComponent(StatsWidget);
    fixture.detectChanges();

    httpTesting.expectOne('/api/stats').flush({ totalSources: 5, totalDocs: 20, totalChunks: 100 });
    httpTesting.expectOne('/healthz/ready').error(new ProgressEvent('error'));
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component['loading']()).toBe(false);
    // Stats tiles should still have data
    expect(component['stats']()?.totalSources).toBe(5);
    // Health tile should be null (renders '—' in template)
    expect(component['health']()).toBeNull();
  });

  it('still populates health tile when /api/stats fails (partial failure)', () => {
    const fixture = TestBed.createComponent(StatsWidget);
    fixture.detectChanges();

    httpTesting.expectOne('/api/stats').error(new ProgressEvent('error'));
    httpTesting.expectOne('/healthz/ready').flush({
      status: 'ok',
      pendingJobs: 7,
      totalSources: 0,
      provider: 'local',
      model: 'test',
      dimensions: 768,
      schedulerRunning: false,
    });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component['loading']()).toBe(false);
    // Stats tiles should be null (renders '—' in template)
    expect(component['stats']()).toBeNull();
    // Health tile should still have data
    expect(component['health']()?.pendingJobs).toBe(7);
  });
});
