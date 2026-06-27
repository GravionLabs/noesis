import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { Settings } from './settings';
import { SettingsService } from '../../core/services/settings.service';

describe('Settings', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    localStorage.clear();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
    return fixture;
  }

  it('saveApiKey persists via SettingsService', () => {
    const fixture = createComponent();
    const service = TestBed.inject(SettingsService);
    const component = fixture.componentInstance;

    component['apiKeyValue'].set('my-secret-key');
    component['saveApiKey']();

    expect(service.apiKey()).toBe('my-secret-key');
    expect(localStorage.getItem('noesis_api_key')).toBe('my-secret-key');
  });

  it('saveBaseUrl persists via SettingsService', () => {
    const fixture = createComponent();
    const service = TestBed.inject(SettingsService);
    const component = fixture.componentInstance;

    component['baseUrlValue'].set('http://my-server:5000');
    component['saveBaseUrl']();

    expect(service.baseUrl()).toBe('http://my-server:5000');
    expect(localStorage.getItem('noesis_base_url')).toBe('http://my-server:5000');
  });

  it('toggleApiKeyVisibility flips the visibility signal', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    expect(component['apiKeyVisible']()).toBe(false);

    component['toggleApiKeyVisibility']();
    expect(component['apiKeyVisible']()).toBe(true);

    component['toggleApiKeyVisibility']();
    expect(component['apiKeyVisible']()).toBe(false);
  });
});
