import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Message } from 'primeng/message';
import type { Job } from '../../core/models/job.model';
import { NoesisApiService } from '../../core/services/noesis-api.service';
import { DurationPipe } from '../../shared/pipes/duration.pipe';
import { JobStatusBadgeComponent } from '../../shared/components/job-status-badge/job-status-badge';

@Component({
  selector: 'app-job-detail',
  standalone: true,
  imports: [RouterLink, Button, Card, Message, DurationPipe, JobStatusBadgeComponent],
  templateUrl: './job-detail.html',
})
export class JobDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(NoesisApiService);
  private readonly messageService = inject(MessageService);

  protected readonly job = signal<Job | undefined>(undefined);

  protected readonly jobId = this.route.snapshot.paramMap.get('id') ?? '';

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.api.getJob(this.jobId).subscribe((job) => this.job.set(job));
  }

  protected retryJob(): void {
    this.api.retryJob(this.jobId).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Retry started' });
        this.router.navigate(['/jobs']);
      },
      error: (err: Error) => {
        this.messageService.add({ severity: 'error', summary: 'Retry failed', detail: err.message });
      },
    });
  }
}
