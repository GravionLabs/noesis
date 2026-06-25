import { Component, ElementRef, ViewChild, inject, signal, AfterViewInit, OnDestroy, afterNextRender, Injector } from '@angular/core';
import { forkJoin, of, type Subscription } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Chart, registerables } from 'chart.js';
import { NoesisApiService } from '../../../core/services/noesis-api.service';

Chart.register(...registerables);

@Component({
  selector: 'app-sources-chart-widget',
  standalone: true,
  templateUrl: './sources-chart-widget.html',
  host: { class: 'block' },
})
export class SourcesChartWidget implements AfterViewInit, OnDestroy {
  private api = inject(NoesisApiService);
  private injector = inject(Injector);

  @ViewChild('chartCanvas') canvas!: ElementRef<HTMLCanvasElement>;
  private chart: Chart<'bar'> | null = null;
  private dataReady = false;
  private latestData: { name: string; chunkCount: number }[] = [];
  private dataSub: Subscription | null = null;

  protected loading = signal(true);
  protected empty = signal(false);

  constructor() {
    this.loadData();
  }

  ngAfterViewInit(): void {
    if (this.dataReady) this.createChart();
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
    this.chart?.destroy();
  }

  private loadData(): void {
    this.dataSub = this.api.listSources().pipe(
      switchMap((sources) => {
        if (sources.length === 0) {
          this.empty.set(true);
          this.loading.set(false);
          return of([] as { name: string; chunkCount: number }[]);
        }
        const stats$ = sources.map((s) =>
          this.api.getSourceStats(s.id).pipe(
            map((stats) => ({ name: s.name, chunkCount: stats.chunkCount })),
          ),
        );
        return forkJoin(stats$);
      }),
    ).subscribe({
      next: (data) => {
        this.latestData = data;
        this.dataReady = true;
        this.loading.set(false);
        // Defer chart creation until after Angular flushes the @if block to the DOM.
        // @ViewChild('chartCanvas') is only populated after the next render cycle,
        // because the canvas lives inside an @if (loading()) branch that was hidden.
        afterNextRender(() => {
          if (this.canvas) this.createChart();
        }, { injector: this.injector });
      },
      error: () => this.loading.set(false),
    });
  }

  private createChart(): void {
    if (!this.canvas?.nativeElement) return;

    const labels = this.latestData.map((d) => d.name);
    const values = this.latestData.map((d) => d.chunkCount);

    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = values;
      this.chart.update();
      return;
    }

    this.chart = new Chart(this.canvas.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Chunks',
            data: values,
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { ticks: { maxRotation: 45 } },
        },
      },
    });
  }
}
