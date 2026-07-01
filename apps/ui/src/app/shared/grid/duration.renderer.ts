import { Component, type OnDestroy } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import { DurationPipe } from '../pipes/duration.pipe';

@Component({
  standalone: true,
  imports: [DurationPipe],
  template: `{{ value | duration }}`,
})
export class DurationRenderer implements ICellRendererAngularComp, OnDestroy {
  value: number | null = null;

  agInit(params: ICellRendererParams): void {
    this.value = params.value;
  }

  refresh(params: ICellRendererParams): boolean {
    this.value = params.value;
    return true;
  }

  ngOnDestroy(): void {
  }
}
