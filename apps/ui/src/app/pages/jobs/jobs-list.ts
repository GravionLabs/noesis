import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
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

type StatusFilter = 'all' | 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

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
  private readonly confirmationService = inject(ConfirmationService);

  protected readonly statusFilter = signal<StatusFilter>('all');

  protected readonly filteredJobs = computed(() => {
    const filter = this.statusFilter();
    const tick = this.store.tick();
    const jobs = this.store.jobs();
    const withLiveDuration = jobs.map((j) => {
      if (j.status === 'running' && j.startedAt) {
        return { ...j, durationMs: tick - new Date(j.startedAt).getTime() };
      }
      return j;
    });
    return filter === 'all' ? withLiveDuration : withLiveDuration.filter((job) => job.status === filter);
  });

  protected sourceName(sourceId: string): string {
    return this.sourcesStore.sourceById()(sourceId)?.name ?? sourceId;
  }

  constructor() {
    this.store.loadJobs();
    this.sourcesStore.loadSources();
    this.store.connectSse();
    this.store.startTick();
  }

  ngOnDestroy(): void {
    this.store.disconnectSse();
    this.store.stopTick();
  }

  protected setFilter(filter: StatusFilter): void {
    this.statusFilter.set(filter);
  }

  protected retryJob(job: Job): void {
    this.store.retryJob(job.id);
    this.messageService.add({ severity: 'success', summary: 'Retry started' });
  }

  protected cancelJob(job: Job): void {
    this.store.cancelJob(job.id);
    this.messageService.add({ severity: 'info', summary: 'Cancel requested' });
  }

  protected confirmDelete(job: Job): void {
    this.confirmationService.confirm({
      header: 'Delete Job',
      message: `Delete job ${job.id.slice(0, 8)}? This cannot be undone.`,
      accept: () => this.deleteJob(job),
    });
  }

  private deleteJob(job: Job): void {
    this.store.deleteJob(job.id);
    this.messageService.add({ severity: 'success', summary: 'Job deleted' });
  }
}
