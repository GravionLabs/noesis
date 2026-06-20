import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(() => {
    localStorage.clear();
    service = new SettingsService();
  });

  it('has default empty apiKey', () => {
    expect(service.apiKey()).toBe('');
  });

  it('has default empty baseUrl', () => {
    expect(service.baseUrl()).toBe('');
  });

  it('hasApiKey is false when key is empty', () => {
    expect(service.hasApiKey()).toBe(false);
  });

  it('saveApiKey updates signal and localStorage', () => {
    service.saveApiKey('test-key-123');
    expect(service.apiKey()).toBe('test-key-123');
    expect(service.hasApiKey()).toBe(true);
    expect(localStorage.getItem('noesis_api_key')).toBe('test-key-123');
  });

  it('saveBaseUrl updates signal and localStorage', () => {
    service.saveBaseUrl('http://localhost:9999');
    expect(service.baseUrl()).toBe('http://localhost:9999');
    expect(localStorage.getItem('noesis_base_url')).toBe('http://localhost:9999');
  });

  it('persists apiKey across service instances', () => {
    localStorage.setItem('noesis_api_key', 'persisted-key');
    const newService = new SettingsService();
    expect(newService.apiKey()).toBe('persisted-key');
  });
});
