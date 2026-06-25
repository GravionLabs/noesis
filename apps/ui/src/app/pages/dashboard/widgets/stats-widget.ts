import { Component, inject, signal, OnDestroy } from '@angular/core';
import { forkJoin, of, type Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NoesisApiService } from '../../../core/services/noesis-api.service';
import type { AggregateStats, HealthInfo } from '../../../core/models/stats.model';

@Component({
  selector: 'app-stats-widget',
  standalone: true,
  templateUrl: './stats-widget.html',
  host: { class: 'block' },
})
export class StatsWidget implements OnDestroy {
  private api = inject(NoesisApiService);
  private sub: Subscription | null = null;

  protected stats = signal<AggregateStats | null>(null);
  protected health = signal<HealthInfo | null>(null);
  protected loading = signal(true);

  constructor() {
    this.sub = forkJoin({
      stats: this.api.getStats().pipe(catchError(() => of(null))),
      health: this.api.getHealth().pipe(catchError(() => of(null))),
    }).subscribe({
      next: (result) => {
        this.stats.set(result.stats);
        this.health.set(result.health);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
