import { Component, input } from '@angular/core';
import type { JobStatus } from '../../../core/models/job.model';

@Component({
  selector: 'app-job-status-badge',
  standalone: true,
  template: `
    <span [class]="'badge badge-' + status()">
      <span class="icon" [class.spin]="status() === 'running'" [innerHTML]="iconHtml()"></span>
      {{ status() }}
    </span>
  `,
  styles: [
    `
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-running { background: #dbeafe; color: #1e40af; }
    .badge-done { background: #d1fae5; color: #065f46; }
    .badge-failed { background: #fee2e2; color: #991b1b; }
    .badge-cancelled { background: #f3e8ff; color: #6b21a8; }
    .icon { font-size: 0.875rem; display: inline-block; }
    .icon.spin { animation: spin 1s linear infinite; }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    `,
  ],
})
export class JobStatusBadgeComponent {
  readonly status = input.required<JobStatus>();

  protected iconHtml(): string {
    switch (this.status()) {
      case 'pending': return '\u23F1';
      case 'running': return '\u27F3';
      case 'done': return '\u2713';
      case 'failed': return '\u2717';
      case 'cancelled': return '\u2716';
    }
  }
}
