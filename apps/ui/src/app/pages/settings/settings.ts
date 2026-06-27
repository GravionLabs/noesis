import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Toolbar } from 'primeng/toolbar';
import { Card } from 'primeng/card';
import { InputText } from 'primeng/inputtext';
import { Button } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { HelixConfigurator } from '@gravionlabs/helix';
import { SettingsService } from '../../core/services/settings.service';
import { NoesisApiService } from '../../core/services/noesis-api.service';
import type { HealthInfo } from '../../core/models/stats.model';

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
    Skeleton,
    Message,
    Tag,
    HelixConfigurator,
  ],
})
export class Settings implements OnInit {
  protected readonly settingsService = inject(SettingsService);
  private readonly api = inject(NoesisApiService);

  protected apiKeyValue = signal(this.settingsService.apiKey());
  protected baseUrlValue = signal(this.settingsService.baseUrl());
  protected apiKeyVisible = signal(false);

  protected health = signal<HealthInfo | null>(null);
  protected healthLoading = signal(true);
  protected healthError = signal(false);

  ngOnInit(): void {
    this.loadHealth();
  }

  protected loadHealth(): void {
    this.healthLoading.set(true);
    this.healthError.set(false);
    this.api.getHealth().subscribe({
      next: (info) => {
        this.health.set(info);
        this.healthLoading.set(false);
      },
      error: () => {
        this.healthError.set(true);
        this.healthLoading.set(false);
      },
    });
  }

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
