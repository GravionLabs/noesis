import { Component, type OnDestroy } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import { JobStatusBadgeComponent } from '../components/job-status-badge/job-status-badge';
import type { JobStatus } from '../../core/models/job.model';

@Component({
  standalone: true,
  imports: [JobStatusBadgeComponent],
  template: `<app-job-status-badge [status]="status" />`,
})
export class StatusBadgeRenderer implements ICellRendererAngularComp, OnDestroy {
  status: JobStatus = 'pending';

  agInit(params: ICellRendererParams): void {
    this.status = params.value as JobStatus;
  }

  refresh(params: ICellRendererParams): boolean {
    this.status = params.value as JobStatus;
    return true;
  }

  ngOnDestroy(): void {
  }
}
