import { Component, type OnDestroy } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import { DateTimePipe } from '../pipes/datetime.pipe';

@Component({
  standalone: true,
  imports: [DateTimePipe],
  template: `{{ value | datetime }}`,
})
export class DatetimeRenderer implements ICellRendererAngularComp, OnDestroy {
  value: string | null = null;

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
