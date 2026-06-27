import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ServerHealthSection } from './server-health-section';
import type { HealthInfo } from '../../core/models/stats.model';

const HEALTH: HealthInfo = {
  status: 'ok',
  provider: 'local',
  model: 'Xenova/bge-base-en-v1.5',
  dimensions: 768,
  schedulerRunning: true,
  pendingJobs: 2,
  totalSources: 5,
};

describe('ServerHealthSection', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServerHealthSection],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(ServerHealthSection);
    fixture.detectChanges();
    return fixture;
  }

  it('loads health on init', () => {
    const fixture = createComponent();
    const req = httpTesting.expectOne('/healthz/ready');
    expect(req.request.method).toBe('GET');
    req.flush(HEALTH);
    fixture.detectChanges();

    expect(fixture.componentInstance['health']()).toEqual(HEALTH);
    expect(fixture.componentInstance['healthLoading']()).toBe(false);
    expect(fixture.componentInstance['healthError']()).toBe(false);
  });

  it('sets healthError when health request fails', () => {
    const fixture = createComponent();
    const req = httpTesting.expectOne('/healthz/ready');
    req.flush('error', { status: 500, statusText: 'Internal Server Error' });
    fixture.detectChanges();

    expect(fixture.componentInstance['healthError']()).toBe(true);
    expect(fixture.componentInstance['healthLoading']()).toBe(false);
    expect(fixture.componentInstance['health']()).toBeNull();
  });

  it('loadHealth re-fetches and clears error state', () => {
    const fixture = createComponent();
    httpTesting.expectOne('/healthz/ready').flush('error', {
      status: 503,
      statusText: 'Service Unavailable',
    });
    fixture.detectChanges();
    expect(fixture.componentInstance['healthError']()).toBe(true);

    fixture.componentInstance['loadHealth']();
    const req = httpTesting.expectOne('/healthz/ready');
    req.flush(HEALTH);
    fixture.detectChanges();

    expect(fixture.componentInstance['healthError']()).toBe(false);
    expect(fixture.componentInstance['health']()).toEqual(HEALTH);
  });
});
