import { Component, type OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import type { Job } from '../../core/models/job.model';

@Component({
  standalone: true,
  template: `
    @if (sourceId) {
      <a (click)="navigate()" class="cursor-pointer text-primary hover:underline">{{ name }}</a>
    } @else {
      —
    }
  `,
})
export class JobSourceLinkRenderer implements ICellRendererAngularComp, OnDestroy {
  private readonly router = inject(Router);

  sourceId: string | null = null;
  name: string = '';

  agInit(params: ICellRendererParams): void {
    const job = params.data as Job;
    this.sourceId = job.sourceId;
    this.name = params.context.sourceName(job.sourceId);
  }

  refresh(params: ICellRendererParams): boolean {
    const job = params.data as Job;
    this.sourceId = job.sourceId;
    this.name = params.context.sourceName(job.sourceId);
    return true;
  }

  navigate(): void {
    if (this.sourceId) {
      this.router.navigate(['/sources', this.sourceId]);
    }
  }

  ngOnDestroy(): void {
  }
}
