import type { Routes } from '@angular/router';
import { HelixEmpty, HelixNotfound, helixRoutesFrom } from '@gravionlabs/helix';
import { AppShell } from './shell/app-shell';
import { NOESIS_MENU_MODEL } from './shell/menu.model';
import { SourceDetail } from './pages/sources/source-detail';
import { SourcesList } from './pages/sources/sources-list';

export const routes: Routes = [
  {
    path: '',
    component: AppShell,
    children: [
      ...helixRoutesFrom(NOESIS_MENU_MODEL),
      {
        // Componentless parent mirroring the 'Knowledge Base' nav grouping,
        // so Query/Jobs/Sources all get a "Knowledge Base > ..." breadcrumb
        // trail — helixBreadcrumbsFromRoutes only shows a trail once it
        // resolves 2+ labeled ancestors.
        path: '',
        data: { breadcrumb: 'Knowledge Base' },
        children: [
          { path: 'query', component: HelixEmpty, data: { breadcrumb: 'Query' } },
          { path: 'jobs', component: HelixEmpty, data: { breadcrumb: 'Jobs' } },
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
