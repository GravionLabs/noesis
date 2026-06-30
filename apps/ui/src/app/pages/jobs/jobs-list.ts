import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Toolbar } from 'primeng/toolbar';
import { Tooltip } from 'primeng/tooltip';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef } from 'ag-grid-community';
import type { Job, JobStatus } from '../../core/models/job.model';
import { JobsStore } from '../../core/stores/jobs.store';
import { SourcesStore } from '../../core/stores/sources.store';
import { defaultColDef, StatusBadgeRenderer, DurationRenderer, DatetimeRenderer } from '../../shared/grid';
import { JobActionsRenderer } from './job-actions.renderer';
import { JobSourceLinkRenderer } from './job-source-link.renderer';

type StatusFilter = 'all' | 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [
    AgGridAngular,
    Button,
    Toolbar,
    Tooltip,
    StatusBadgeRenderer,
    DurationRenderer,
    DatetimeRenderer,
    JobActionsRenderer,
    JobSourceLinkRenderer,
  ],
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

  protected readonly defaultColDef = defaultColDef;

  protected readonly colDefs: ColDef[] = [
    { field: 'actions', headerName: '', cellRenderer: JobActionsRenderer, sortable: false, width: 180 },
    { field: 'status', headerName: 'Status', cellRenderer: StatusBadgeRenderer, sortable: true },
    { field: 'type', headerName: 'Type', sortable: true },
    { field: 'sourceId', headerName: 'Source', cellRenderer: JobSourceLinkRenderer, sortable: false },
    { field: 'createdAt', headerName: 'Created', cellRenderer: DatetimeRenderer, sortable: true },
    { field: 'durationMs', headerName: 'Duration', cellRenderer: DurationRenderer, sortable: true },
  ];

  protected readonly context = {
    sourceName: (sourceId: string | null) => this.sourceName(sourceId),
    cancelJob: (job: Job) => this.cancelJob(job),
    retryJob: (job: Job) => this.retryJob(job),
    confirmDelete: (job: Job) => this.confirmDelete(job),
  };

  protected sourceName(sourceId: string | null): string {
    if (!sourceId) return '';
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
