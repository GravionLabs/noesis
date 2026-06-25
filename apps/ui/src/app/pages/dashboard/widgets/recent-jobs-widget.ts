import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JobsStore } from '../../../core/stores/jobs.store';
import { JobStatusBadgeComponent } from '../../../shared/components/job-status-badge/job-status-badge';
import { DurationPipe } from '../../../shared/pipes/duration.pipe';

@Component({
  selector: 'app-recent-jobs-widget',
  standalone: true,
  imports: [RouterLink, JobStatusBadgeComponent, DurationPipe],
  templateUrl: './recent-jobs-widget.html',
  host: { class: 'block' },
})
export class RecentJobsWidget {
  private store = inject(JobsStore);

  /** Top-5 most recently created jobs, kept live via the store's SSE stream. */
  protected jobs = computed(() =>
    [...this.store.jobs()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5),
  );

  protected loading = this.store.loading;
}
