import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import type { Job } from '../../core/models/job.model';
import { NoesisApiService } from '../../core/services/noesis-api.service';
import { SourcesStore } from '../../core/stores/sources.store';
import { JobsStore } from '../../core/stores/jobs.store';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { DateTimePipe } from '../../shared/pipes/datetime.pipe';
import { JobStatusBadgeComponent } from '../../shared/components/job-status-badge/job-status-badge';
import { JobLogsComponent } from '../../shared/components/job-logs/job-logs';

@Component({
  selector: 'app-job-detail',
  standalone: true,
  imports: [RouterLink, Button, Card, Message, DurationPipe, DateTimePipe, JobStatusBadgeComponent, JobLogsComponent],
  templateUrl: './job-detail.html',
  styles: [`
    :host ::ng-deep .p-card-body,
    :host ::ng-deep .p-card-content {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
  `],
})
export class JobDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(NoesisApiService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  protected readonly sourcesStore = inject(SourcesStore);
  protected readonly jobsStore = inject(JobsStore);

  protected readonly jobId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly liveJob = computed(() => {
    const tick = this.jobsStore.tick();
    const job = this.jobsStore.jobs().find((j) => j.id === this.jobId);
    if (!job) return undefined;
    if (job.status === 'running' && job.startedAt) {
      return { ...job, durationMs: tick - new Date(job.startedAt).getTime() };
    }
    return job;
  });

  protected sourceName(sourceId: string): string {
    return this.sourcesStore.sourceById()(sourceId)?.name ?? sourceId;
  }

  ngOnInit(): void {
    this.sourcesStore.loadSources();
    this.jobsStore.connectSse();
    this.jobsStore.startTick();
    this.jobsStore.loadJobs();
  }

  protected retryJob(): void {
    this.api.retryJob(this.jobId).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Retry started' });
        this.router.navigate(['/jobs', res.jobId]);
      },
      error: (err: Error) => {
        this.messageService.add({ severity: 'error', summary: 'Retry failed', detail: err.message });
      },
    });
  }

  protected cancelJob(): void {
    this.api.cancelJob(this.jobId).subscribe({
      next: () => {
        this.messageService.add({ severity: 'info', summary: 'Cancel requested' });
      },
      error: (err: Error) => {
        this.messageService.add({ severity: 'error', summary: 'Cancel failed', detail: err.message });
      },
    });
  }

  protected confirmDelete(): void {
    this.confirmationService.confirm({
      header: 'Delete Job',
      message: `Delete job ${this.jobId.slice(0, 8)}? This cannot be undone.`,
      accept: () => this.deleteJob(),
    });
  }

  private deleteJob(): void {
    this.api.deleteJob(this.jobId).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Job deleted' });
        this.router.navigate(['/jobs']);
      },
      error: (err: Error) => {
        this.messageService.add({ severity: 'error', summary: 'Delete failed', detail: err.message });
      },
    });
  }
}
