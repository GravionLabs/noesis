import { Component, inject, signal, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { interval, type Subscription } from 'rxjs';
import { NoesisApiService } from '../../../core/services/noesis-api.service';
import type { Job } from '../../../core/models/job.model';
import { JobStatusBadgeComponent } from '../../../shared/components/job-status-badge/job-status-badge';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';

@Component({
  selector: 'app-recent-jobs-widget',
  standalone: true,
  imports: [RouterLink, JobStatusBadgeComponent, DurationPipe],
  templateUrl: './recent-jobs-widget.html',
  host: { class: 'block' },
})
export class RecentJobsWidget implements OnDestroy {
  private api = inject(NoesisApiService);
  private refreshSub: Subscription | null = null;

  protected jobs = signal<Job[]>([]);
  protected loading = signal(true);

  constructor() {
    this.loadJobs();
    this.refreshSub = interval(30000).subscribe(() => this.loadJobs());
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  private loadJobs(): void {
    this.api.listJobs().subscribe({
      next: (jobs) => {
        this.jobs.set(
          [...jobs]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5),
        );
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
