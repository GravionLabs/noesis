import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Settings } from './settings';
import { SettingsService } from '../../core/services/settings.service';
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

describe('Settings', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    localStorage.clear();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(Settings);
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

  it('saveApiKey persists via SettingsService', () => {
    const fixture = createComponent();
    httpTesting.expectOne('/healthz/ready').flush(HEALTH);

    const service = TestBed.inject(SettingsService);
    const component = fixture.componentInstance;

    component['apiKeyValue'].set('my-secret-key');
    component['saveApiKey']();

    expect(service.apiKey()).toBe('my-secret-key');
    expect(localStorage.getItem('noesis_api_key')).toBe('my-secret-key');
  });

  it('saveBaseUrl persists via SettingsService', () => {
    const fixture = createComponent();
    httpTesting.expectOne('/healthz/ready').flush(HEALTH);

    const service = TestBed.inject(SettingsService);
    const component = fixture.componentInstance;

    component['baseUrlValue'].set('http://my-server:5000');
    component['saveBaseUrl']();

    expect(service.baseUrl()).toBe('http://my-server:5000');
    expect(localStorage.getItem('noesis_base_url')).toBe('http://my-server:5000');
  });

  it('toggleApiKeyVisibility flips the visibility signal', () => {
    const fixture = createComponent();
    httpTesting.expectOne('/healthz/ready').flush(HEALTH);

    const component = fixture.componentInstance;
    expect(component['apiKeyVisible']()).toBe(false);

    component['toggleApiKeyVisibility']();
    expect(component['apiKeyVisible']()).toBe(true);

    component['toggleApiKeyVisibility']();
    expect(component['apiKeyVisible']()).toBe(false);
  });

  it('loadHealth re-fetches and clears error state', () => {
    const fixture = createComponent();
    // Initial load fails
    httpTesting.expectOne('/healthz/ready').flush('error', { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();
    expect(fixture.componentInstance['healthError']()).toBe(true);

    // Manually trigger reload
    fixture.componentInstance['loadHealth']();
    const req = httpTesting.expectOne('/healthz/ready');
    req.flush(HEALTH);
    fixture.detectChanges();

    expect(fixture.componentInstance['healthError']()).toBe(false);
    expect(fixture.componentInstance['health']()).toEqual(HEALTH);
  });
});
