import { Component, inject, signal } from '@angular/core';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { Message } from 'primeng/message';
import { Tag } from 'primeng/tag';
import { Button } from 'primeng/button';
import { NoesisApiService } from '../../core/services/noesis-api.service';
import type { HealthInfo } from '../../core/models/stats.model';

@Component({
  selector: 'app-server-health-section',
  templateUrl: './server-health-section.html',
  host: { class: 'block' },
  imports: [Card, Skeleton, Message, Tag, Button],
})
export class ServerHealthSection {
  private readonly api = inject(NoesisApiService);

  protected readonly health = signal<HealthInfo | null>(null);
  protected readonly healthLoading = signal(true);
  protected readonly healthError = signal(false);

  constructor() {
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
}
