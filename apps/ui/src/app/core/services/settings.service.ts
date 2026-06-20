import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly apiKey = signal<string>(localStorage.getItem('noesis_api_key') ?? '');
  readonly baseUrl = signal<string>(localStorage.getItem('noesis_base_url') ?? 'http://localhost:5000');
  readonly hasApiKey = computed(() => this.apiKey().length > 0);

  saveApiKey(key: string): void {
    this.apiKey.set(key);
    localStorage.setItem('noesis_api_key', key);
  }

  saveBaseUrl(url: string): void {
    this.baseUrl.set(url);
    localStorage.setItem('noesis_base_url', url);
  }
}
