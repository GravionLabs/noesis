import { Component, type OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import { ToggleSwitch } from 'primeng/toggleswitch';
import type { Source } from '../../core/models/source.model';

@Component({
  standalone: true,
  imports: [FormsModule, ToggleSwitch],
  template: `<p-toggleswitch [ngModel]="enabled" (onChange)="onToggle($event.checked)" />`,
})
export class ToggleSwitchRenderer implements ICellRendererAngularComp, OnDestroy {
  private source!: Source;
  private toggleEnabledFn!: (source: Source, enabled: boolean) => void;
  enabled: boolean = false;

  agInit(params: ICellRendererParams): void {
    this.source = params.data as Source;
    this.enabled = this.source.enabled;
    this.toggleEnabledFn = params.context.toggleEnabled;
  }

  refresh(params: ICellRendererParams): boolean {
    this.source = params.data as Source;
    this.enabled = this.source.enabled;
    this.toggleEnabledFn = params.context.toggleEnabled;
    return true;
  }

  onToggle(checked: boolean): void {
    this.toggleEnabledFn(this.source, checked);
  }

  ngOnDestroy(): void {
  }
}
