import type { Routes } from '@angular/router';
import { HelixNotfound, helixRoutesFrom } from '@gravionlabs/helix';
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
        path: 'sources',
        // Componentless parent so /sources and /sources/:id share this
        // breadcrumb ancestor — helixBreadcrumbsFromRoutes only shows a
        // trail once it has 2+ labeled segments.
        data: { breadcrumb: 'Sources' },
        children: [
          { path: '', component: SourcesList },
          { path: ':id', component: SourceDetail, data: { breadcrumb: 'Details' } },
        ],
      },
    ],
  },
  { path: 'notfound', component: HelixNotfound },
  { path: '**', redirectTo: '/notfound' },
];
