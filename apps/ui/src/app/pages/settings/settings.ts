import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Toolbar } from 'primeng/toolbar';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { HelixConfigurator } from '@gravionlabs/helix';
import { SettingsService } from '../../core/services/settings.service';
import { ServerHealthSection } from './server-health-section';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.html',
  host: { class: 'block' },
  imports: [
    FormsModule,
    Toolbar,
    Card,
    InputText,
    Button,
    HelixConfigurator,
    ServerHealthSection,
  ],
})
export class Settings {
  protected readonly settingsService = inject(SettingsService);

  protected apiKeyValue = signal(this.settingsService.apiKey());
  protected baseUrlValue = signal(this.settingsService.baseUrl());
  protected apiKeyVisible = signal(false);

  protected saveApiKey(): void {
    this.settingsService.saveApiKey(this.apiKeyValue());
  }

  protected saveBaseUrl(): void {
    this.settingsService.saveBaseUrl(this.baseUrlValue());
  }

  protected toggleApiKeyVisibility(): void {
    this.apiKeyVisible.update((v) => !v);
  }
}
