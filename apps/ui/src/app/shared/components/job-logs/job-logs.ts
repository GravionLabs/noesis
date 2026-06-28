import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, switchMap, tap, startWith } from 'rxjs';
import type { JobLogEntry } from '../../../core/models/job.model';
import { NoesisApiService } from '../../../core/services/noesis-api.service';
import { DateTimePipe } from '../../pipes/datetime.pipe';

@Component({
  selector: 'app-job-logs',
  standalone: true,
  imports: [DateTimePipe],
  template: `
    @if (logs().length === 0) {
      <div class="text-muted">No log entries yet.</div>
    }
    @for (entry of logs(); track entry.id) {
      <div class="flex gap-2">
        <span class="text-muted shrink-0">{{ entry.createdAt | datetime }}</span>
        <span [class]="'level-' + entry.level">{{ entry.message }}</span>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .text-muted { color: var(--text-color-secondary); }
    .level-warn { color: var(--yellow-500); }
    .level-error { color: var(--red-500); }
  `],
})
export class JobLogsComponent implements OnInit {
  private readonly api = inject(NoesisApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly jobId = input.required<string>();
  readonly autoPoll = input(false);

  protected readonly logs = signal<JobLogEntry[]>([]);

  ngOnInit(): void {
    if (this.autoPoll()) {
      interval(3000).pipe(
        startWith(0),
        takeUntilDestroyed(this.destroyRef),
        switchMap(() => this.api.getJobLogs(this.jobId())),
      ).subscribe((logs) => this.logs.set(logs));
    } else {
      this.api.getJobLogs(this.jobId()).subscribe((logs) => this.logs.set(logs));
    }
  }
}
