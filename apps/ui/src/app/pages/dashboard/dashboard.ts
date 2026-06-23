import { Component } from '@angular/core';
import { Toolbar } from 'primeng/toolbar';
import { StatsWidget } from './widgets/stats-widget';
import { RecentJobsWidget } from './widgets/recent-jobs-widget';
import { SourcesChartWidget } from './widgets/sources-chart-widget';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [Toolbar, StatsWidget, RecentJobsWidget, SourcesChartWidget],
  templateUrl: './dashboard.html',
  host: { class: 'block' },
})
export class Dashboard {}
