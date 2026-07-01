import { Component, type OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import type { Source } from '../../core/models/source.model';

@Component({
  standalone: true,
  template: `<a (click)="navigate()" class="cursor-pointer text-primary hover:underline">{{ name }}</a>`,
})
export class SourceLinkRenderer implements ICellRendererAngularComp, OnDestroy {
  private readonly router = inject(Router);

  id: string = '';
  name: string = '';

  agInit(params: ICellRendererParams): void {
    const source = params.data as Source;
    this.id = source.id;
    this.name = source.name;
  }

  refresh(params: ICellRendererParams): boolean {
    const source = params.data as Source;
    this.id = source.id;
    this.name = source.name;
    return true;
  }

  navigate(): void {
    this.router.navigate(['/sources', this.id]);
  }

  ngOnDestroy(): void {
  }
}
