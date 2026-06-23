import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { Toolbar } from 'primeng/toolbar';
import { Tooltip } from 'primeng/tooltip';
import type { Job, JobStatus } from '../../core/models/job.model';
import { JobsStore } from '../../core/stores/jobs.store';
import { SourcesStore } from '../../core/stores/sources.store';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { DateTimePipe } from '../../shared/pipes/datetime.pipe';
import { JobStatusBadgeComponent } from '../../shared/components/job-status-badge/job-status-badge';

type StatusFilter = 'all' | JobStatus;

@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [RouterLink, TableModule, Button, Toolbar, Tooltip, DurationPipe, DateTimePipe, JobStatusBadgeComponent],
  host: { class: 'block' },
  templateUrl: './jobs-list.html',
})
export class JobsList implements OnDestroy {
  protected readonly store = inject(JobsStore);
  protected readonly sourcesStore = inject(SourcesStore);
  private readonly messageService = inject(MessageService);

  protected readonly statusFilter = signal<StatusFilter>('all');

  protected readonly filteredJobs = computed(() => {
    const filter = this.statusFilter();
    const jobs = this.store.jobs();
    return filter === 'all' ? jobs : jobs.filter((job) => job.status === filter);
  });

  protected sourceName(sourceId: string): string {
    return this.sourcesStore.sourceById()(sourceId)?.name ?? sourceId;
  }

  constructor() {
    this.store.loadJobs();
    this.sourcesStore.loadSources();

    effect(() => {
      if (this.store.hasActiveJobs()) {
        this.store.startAutoRefresh();
      } else {
        this.store.stopAutoRefresh();
      }
    });
  }

  ngOnDestroy(): void {
    this.store.stopAutoRefresh();
  }

  protected setFilter(filter: StatusFilter): void {
    this.statusFilter.set(filter);
  }

  protected retryJob(job: Job): void {
    this.store.retryJob(job.id);
    this.messageService.add({ severity: 'success', summary: 'Retry started' });
  }
}
