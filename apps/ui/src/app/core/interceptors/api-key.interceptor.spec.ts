import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { apiKeyInterceptor } from './api-key.interceptor';
import { SettingsService } from '../services/settings.service';

describe('apiKeyInterceptor', () => {
  let httpTesting: HttpTestingController;
  let settings: SettingsService;
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiKeyInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    settings = TestBed.inject(SettingsService);
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('adds X-Api-Key header when apiKey is set', () => {
    settings.saveApiKey('secret-123');

    http.get('/api/sources').subscribe();

    const req = httpTesting.expectOne('/api/sources');
    expect(req.request.headers.get('X-Api-Key')).toBe('secret-123');
    req.flush([]);
  });

  it('omits X-Api-Key header when apiKey is empty', () => {
    settings.saveApiKey('');

    http.get('/api/sources').subscribe();

    const req = httpTesting.expectOne('/api/sources');
    expect(req.request.headers.has('X-Api-Key')).toBe(false);
    req.flush([]);
  });

  it('omits X-Api-Key header for non-/api/ requests', () => {
    settings.saveApiKey('secret-123');

    http.get('/health').subscribe();

    const req = httpTesting.expectOne('/health');
    expect(req.request.headers.has('X-Api-Key')).toBe(false);
    req.flush({});
  });
});
