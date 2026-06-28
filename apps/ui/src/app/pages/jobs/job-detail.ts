import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
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
})
export class JobDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(NoesisApiService);
  private readonly messageService = inject(MessageService);
  protected readonly sourcesStore = inject(SourcesStore);
  protected readonly jobsStore = inject(JobsStore);

  protected readonly job = signal<Job | undefined>(undefined);
  protected readonly jobId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly liveJob = computed(() => {
    const j = this.job();
    const tick = this.jobsStore.tick();
    if (!j) return undefined;
    if (j.status === 'running' && j.startedAt) {
      return { ...j, durationMs: tick - new Date(j.startedAt).getTime() };
    }
    return j;
  });

  protected sourceName(sourceId: string): string {
    return this.sourcesStore.sourceById()(sourceId)?.name ?? sourceId;
  }

  ngOnInit(): void {
    this.sourcesStore.loadSources();
    this.jobsStore.startTick();
    this.load();
  }

  private load(): void {
    this.api.getJob(this.jobId).subscribe((job) => this.job.set(job));
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
        this.load();
      },
      error: (err: Error) => {
        this.messageService.add({ severity: 'error', summary: 'Cancel failed', detail: err.message });
      },
    });
  }
}
