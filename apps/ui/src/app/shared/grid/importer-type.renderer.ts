import { Component, type OnDestroy } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import { ImporterTypeBadgeComponent } from '../components/importer-type-badge/importer-type-badge';

@Component({
  standalone: true,
  imports: [ImporterTypeBadgeComponent],
  template: `<app-importer-type-badge [type]="type" />`,
})
export class ImporterTypeRenderer implements ICellRendererAngularComp, OnDestroy {
  type: string = '';

  agInit(params: ICellRendererParams): void {
    this.type = params.value;
  }

  refresh(params: ICellRendererParams): boolean {
    this.type = params.value;
    return true;
  }

  ngOnDestroy(): void {
  }
}
