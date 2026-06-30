import { Component, type OnDestroy } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import type { Source } from '../../core/models/source.model';

@Component({
  standalone: true,
  imports: [Button, Tooltip],
  template: `
    <div class="flex gap-2 justify-end">
      <p-button icon="pi pi-sync" severity="secondary" text (onClick)="onImportNow()" pTooltip="Import Now" />
      <p-button icon="pi pi-pencil" severity="secondary" text (onClick)="onOpenEdit()" pTooltip="Edit" />
      <p-button icon="pi pi-trash" severity="danger" text (onClick)="onConfirmDelete()" pTooltip="Delete" />
    </div>
  `,
})
export class SourceActionsRenderer implements ICellRendererAngularComp, OnDestroy {
  private source!: Source;
  private importNowFn!: (source: Source) => void;
  private openEditFn!: (source: Source) => void;
  private confirmDeleteFn!: (source: Source) => void;

  agInit(params: ICellRendererParams): void {
    this.source = params.data as Source;
    this.importNowFn = params.context.importNow;
    this.openEditFn = params.context.openEdit;
    this.confirmDeleteFn = params.context.confirmDelete;
  }

  refresh(params: ICellRendererParams): boolean {
    this.source = params.data as Source;
    this.importNowFn = params.context.importNow;
    this.openEditFn = params.context.openEdit;
    this.confirmDeleteFn = params.context.confirmDelete;
    return true;
  }

  onImportNow(): void {
    this.importNowFn(this.source);
  }

  onOpenEdit(): void {
    this.openEditFn(this.source);
  }

  onConfirmDelete(): void {
    this.confirmDeleteFn(this.source);
  }

  ngOnDestroy(): void {
  }
}
