import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { Toolbar } from 'primeng/toolbar';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef } from 'ag-grid-community';
import type { Source } from '../../core/models/source.model';
import { NoesisApiService } from '../../core/services/noesis-api.service';
import { SourcesStore } from '../../core/stores/sources.store';
import { defaultColDef, ImporterTypeRenderer, DatetimeRenderer } from '../../shared/grid';
import { SourceLinkRenderer } from './source-link.renderer';
import { ToggleSwitchRenderer } from './toggle-switch.renderer';
import { SourceActionsRenderer } from './source-actions.renderer';
import { SourceFormDialog } from './source-form-dialog';

@Component({
  selector: 'app-sources-list',
  standalone: true,
  imports: [
    AgGridAngular,
    Button,
    Toolbar,
    IconField,
    InputIcon,
    InputText,
    ImporterTypeRenderer,
    DatetimeRenderer,
    SourceLinkRenderer,
    ToggleSwitchRenderer,
    SourceActionsRenderer,
    SourceFormDialog,
  ],
  host: { class: 'block' },
  templateUrl: './sources-list.html',
})
export class SourcesList {
  protected readonly store = inject(SourcesStore);
  private readonly api = inject(NoesisApiService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  protected readonly defaultColDef = defaultColDef;

  protected readonly colDefs: ColDef[] = [
    { field: 'name', headerName: 'Name', cellRenderer: SourceLinkRenderer, sortable: true },
    { field: 'url', headerName: 'URL', sortable: true },
    { field: 'importerType', headerName: 'Importer Type', cellRenderer: ImporterTypeRenderer, sortable: true },
    { field: 'enabled', headerName: 'Enabled', cellRenderer: ToggleSwitchRenderer, sortable: false },
    { field: 'lastImportedAt', headerName: 'Last Imported', cellRenderer: DatetimeRenderer, sortable: true },
    { field: 'actions', headerName: '', cellRenderer: SourceActionsRenderer, sortable: false, width: 160 },
  ];

  protected readonly context = {
    toggleEnabled: (source: Source, enabled: boolean) => this.toggleEnabled(source, enabled),
    importNow: (source: Source) => this.importNow(source),
    openEdit: (source: Source) => this.openEdit(source),
    confirmDelete: (source: Source) => this.confirmDelete(source),
  };

  private gridApi: import('ag-grid-community').GridApi | null = null;

  protected readonly dialogVisible = signal(false);
  protected readonly editingSource = signal<Source | undefined>(undefined);

  constructor() {
    this.store.loadSources();
  }

  protected onGridReady(params: import('ag-grid-community').GridReadyEvent): void {
    this.gridApi = params.api;
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.gridApi?.setGridOption('quickFilterText', value);
  }

  protected openCreate(): void {
    this.editingSource.set(undefined);
    this.dialogVisible.set(true);
  }

  protected openEdit(source: Source): void {
    this.editingSource.set(source);
    this.dialogVisible.set(true);
  }

  protected onSaved(): void {
    this.messageService.add({
      severity: 'success',
      summary: this.editingSource() ? 'Source updated' : 'Source created',
    });
  }

  protected toggleEnabled(source: Source, enabled: boolean): void {
    this.store.updateSource(source.id, { enabled });
  }

  protected confirmDelete(source: Source): void {
    this.confirmationService.confirm({
      header: 'Delete Source',
      message: `Are you sure you want to delete "${source.name}"? This cannot be undone.`,
      accept: () => this.deleteSource(source),
    });
  }

  private deleteSource(source: Source): void {
    this.store.deleteSource(source.id);
    this.messageService.add({ severity: 'success', summary: 'Source deleted' });
  }

  protected importNow(source: Source): void {
    this.api.triggerImport(source.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Import started' });
        this.router.navigate(['/jobs']);
      },
      error: (err: Error) => {
        this.messageService.add({ severity: 'error', summary: 'Import failed', detail: err.message });
      },
    });
  }
}
