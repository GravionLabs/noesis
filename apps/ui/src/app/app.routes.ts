import type { Routes } from '@angular/router';
import { HelixNotfound, helixRoutesFrom } from '@gravionlabs/helix';
import { AppShell } from './shell/app-shell';
import { NOESIS_MENU_MODEL } from './shell/menu.model';
import { SourceDetail } from './pages/sources/source-detail';
import { SourcesList } from './pages/sources/sources-list';
import { JobDetail } from './pages/jobs/job-detail';
import { JobsList } from './pages/jobs/jobs-list';
import { Browse } from './pages/browse/browse';
import { Query } from './pages/query/query';
import { Settings } from './pages/settings/settings';

export const routes: Routes = [
  {
    path: '',
    component: AppShell,
    children: [
      ...helixRoutesFrom(NOESIS_MENU_MODEL),
      // Settings is a top-level nav item (not under 'Knowledge Base'), so its
      // route lives here — outside the componentless 'Knowledge Base' group —
      // and carries no parent breadcrumb label.
      { path: 'settings', component: Settings, data: { breadcrumb: undefined } },
      {
        // Componentless parent mirroring the 'Knowledge Base' nav grouping,
        // so Query/Jobs/Sources all get a "Knowledge Base > ..." breadcrumb
        // trail — helixBreadcrumbsFromRoutes only shows a trail once it
        // resolves 2+ labeled ancestors.
        path: '',
        data: { breadcrumb: 'Knowledge Base' },
        children: [
          { path: 'query', component: Query, data: { breadcrumb: 'Query' } },
          { path: 'browse', component: Browse, data: { breadcrumb: 'Browse' } },
          {
            path: 'jobs',
            data: { breadcrumb: 'Jobs' },
            children: [
              // breadcrumb explicitly undefined: see the matching comment on
              // the 'sources' empty-path child route below.
              { path: '', component: JobsList, data: { breadcrumb: undefined } },
              { path: ':id', component: JobDetail, data: { breadcrumb: 'Details' } },
            ],
          },
          {
            path: 'sources',
            data: { breadcrumb: 'Sources' },
            children: [
              // breadcrumb explicitly undefined: Angular's default
              // emptyOnly param/data inheritance would otherwise copy the
              // parent's 'Sources' breadcrumb onto this empty-path route
              // too, duplicating it in the trail.
              { path: '', component: SourcesList, data: { breadcrumb: undefined } },
              { path: ':id', component: SourceDetail, data: { breadcrumb: 'Details' } },
            ],
          },
        ],
      },
    ],
  },
  { path: 'notfound', component: HelixNotfound },
  { path: '**', redirectTo: '/notfound' },
];
