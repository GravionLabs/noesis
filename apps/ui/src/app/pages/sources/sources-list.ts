import { Component, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Table, TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { Tooltip } from 'primeng/tooltip';
import { Toolbar } from 'primeng/toolbar';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import type { Source } from '../../core/models/source.model';
import { NoesisApiService } from '../../core/services/noesis-api.service';
import { SourcesStore } from '../../core/stores/sources.store';
import { ImporterTypeBadgeComponent } from '../../shared/components/importer-type-badge/importer-type-badge';
import { SourceFormDialog } from './source-form-dialog';

@Component({
  selector: 'app-sources-list',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    TableModule,
    Button,
    ToggleSwitch,
    Tooltip,
    Toolbar,
    IconField,
    InputIcon,
    InputText,
    ImporterTypeBadgeComponent,
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

  private readonly dt = viewChild.required<Table>('dt');

  protected readonly dialogVisible = signal(false);
  protected readonly editingSource = signal<Source | undefined>(undefined);

  constructor() {
    this.store.loadSources();
  }

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.dt().filterGlobal(value, 'contains');
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
