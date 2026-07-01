import { Component, type OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import type { Job, JobStatus } from '../../core/models/job.model';

@Component({
  standalone: true,
  imports: [Button, Tooltip],
  template: `
    <div class="flex gap-2 items-center" style="height: 100%;">
      @if (status === 'running') {
        <p-button icon="pi pi-times" severity="danger" text (onClick)="onCancel()" pTooltip="Cancel" />
      }
      @if (status === 'failed') {
        <p-button icon="pi pi-refresh" severity="secondary" text (onClick)="onRetry()" pTooltip="Retry" />
      }
      @if (status !== 'running' && status !== 'pending') {
        <p-button icon="pi pi-trash" severity="danger" text (onClick)="onConfirmDelete()" pTooltip="Delete" />
      }
      <p-button icon="pi pi-eye" severity="secondary" text (onClick)="onView()" pTooltip="View" />
    </div>
  `,
})
export class JobActionsRenderer implements ICellRendererAngularComp, OnDestroy {
  private readonly router = inject(Router);

  private job!: Job;
  private cancelJobFn!: (job: Job) => void;
  private retryJobFn!: (job: Job) => void;
  private confirmDeleteFn!: (job: Job) => void;

  status: JobStatus = 'pending';

  agInit(params: ICellRendererParams): void {
    this.job = params.data as Job;
    this.status = this.job.status;
    this.cancelJobFn = params.context.cancelJob;
    this.retryJobFn = params.context.retryJob;
    this.confirmDeleteFn = params.context.confirmDelete;
  }

  refresh(params: ICellRendererParams): boolean {
    this.job = params.data as Job;
    this.status = this.job.status;
    this.cancelJobFn = params.context.cancelJob;
    this.retryJobFn = params.context.retryJob;
    this.confirmDeleteFn = params.context.confirmDelete;
    return true;
  }

  onCancel(): void {
    this.cancelJobFn(this.job);
  }

  onRetry(): void {
    this.retryJobFn(this.job);
  }

  onConfirmDelete(): void {
    this.confirmDeleteFn(this.job);
  }

  onView(): void {
    this.router.navigate(['/jobs', this.job.id]);
  }

  ngOnDestroy(): void {
  }
}
