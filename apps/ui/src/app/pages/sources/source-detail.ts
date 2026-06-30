import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Button } from 'primeng/button';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef } from 'ag-grid-community';
import type { Source, SourceStats } from '../../core/models/source.model';
import { NoesisApiService } from '../../core/services/noesis-api.service';
import { JobsStore } from '../../core/stores/jobs.store';
import { defaultColDef, StatusBadgeRenderer, DatetimeRenderer } from '../../shared/grid';
import { DateTimePipe } from '../../shared/pipes/datetime.pipe';
import { SourceFormDialog } from './source-form-dialog';

@Component({
  selector: 'app-source-detail',
  standalone: true,
  imports: [AgGridAngular, Button, StatusBadgeRenderer, DatetimeRenderer, DateTimePipe, SourceFormDialog],
  templateUrl: './source-detail.html',
})
export class SourceDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(NoesisApiService);
  private readonly messageService = inject(MessageService);
  protected readonly jobsStore = inject(JobsStore);

  protected readonly source = signal<Source | undefined>(undefined);
  protected readonly stats = signal<SourceStats | undefined>(undefined);
  protected readonly dialogVisible = signal(false);

  protected readonly sourceId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly jobHistory = computed(() =>
    this.jobsStore.jobs().filter((job) => job.sourceId === this.sourceId),
  );

  protected readonly defaultColDef = defaultColDef;

  protected readonly colDefs: ColDef[] = [
    { field: 'status', headerName: 'Status', cellRenderer: StatusBadgeRenderer, sortable: true },
    { field: 'type', headerName: 'Type', sortable: true },
    { field: 'createdAt', headerName: 'Created', cellRenderer: DatetimeRenderer, sortable: true },
    { field: 'finishedAt', headerName: 'Finished', cellRenderer: DatetimeRenderer, sortable: true },
  ];

  ngOnInit(): void {
    this.load();
    this.jobsStore.loadJobs();
  }

  private load(): void {
    this.api.getSource(this.sourceId).subscribe((source) => this.source.set(source));
    this.api.getSourceStats(this.sourceId).subscribe((stats) => this.stats.set(stats));
  }

  protected openEdit(): void {
    this.dialogVisible.set(true);
  }

  protected onSaved(): void {
    this.messageService.add({ severity: 'success', summary: 'Source updated' });
    this.load();
  }

  protected importNow(): void {
    this.api.triggerImport(this.sourceId).subscribe({
      next: (res) => {
        this.messageService.add({ severity: 'success', summary: 'Import started' });
        this.router.navigate(['/jobs', res.jobId]);
      },
      error: (err: Error) => {
        this.messageService.add({ severity: 'error', summary: 'Import failed', detail: err.message });
      },
    });
  }
}
