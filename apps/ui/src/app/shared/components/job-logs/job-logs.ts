import { Component, DestroyRef, OnInit, inject, input, signal, ElementRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import type { JobLogEntry } from '../../../core/models/job.model';
import { NoesisApiService } from '../../../core/services/noesis-api.service';
import { JobsStore } from '../../../core/stores/jobs.store';
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
      <div class="log-entry">
        <span class="text-muted shrink-0">{{ entry.createdAt | datetime }}</span>
        <span [class]="'level-' + entry.level">{{ entry.message }}</span>
      </div>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; gap: 0.125rem; }
    .log-entry { display: flex; gap: 0.5rem; font-family: ui-monospace, monospace; font-size: 0.8125rem; line-height: 1.4; }
    .text-muted { color: var(--text-color-secondary); white-space: nowrap; }
    .level-warn { color: var(--yellow-500); }
    .level-error { color: var(--red-500); }
  `],
})
export class JobLogsComponent implements OnInit {
  private readonly api = inject(NoesisApiService);
  private readonly jobsStore = inject(JobsStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly el = inject(ElementRef<HTMLElement>);

  readonly jobId = input.required<string>();

  protected readonly logs = signal<JobLogEntry[]>([]);

  ngOnInit(): void {
    this.api.getJobLogs(this.jobId()).subscribe((logs) => {
      this.logs.set([...logs].reverse());
      this.scrollToBottom();
    });

    this.jobsStore.logEvents().pipe(
      filter((entry) => entry.jobId === this.jobId()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((entry) => {
      this.logs.update((current) => {
        if (current.length > 0 && current[current.length - 1].id === entry.id) return current;
        return [...current, entry];
      });
      this.scrollToBottom();
    });
  }

  private scrollToBottom(): void {
    requestAnimationFrame(() => {
      this.el.nativeElement.scrollTop = this.el.nativeElement.scrollHeight;
    });
  }
}
