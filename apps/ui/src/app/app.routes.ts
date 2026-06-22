import type { Routes } from '@angular/router';
import { HelixNotfound, helixRoutesFrom } from '@gravionlabs/helix';
import { AppShell } from './shell/app-shell';
import { NOESIS_MENU_MODEL } from './shell/menu.model';
import { SourceDetail } from './pages/sources/source-detail';

export const routes: Routes = [
  {
    path: '',
    component: AppShell,
    children: [
      ...helixRoutesFrom(NOESIS_MENU_MODEL),
      { path: 'sources/:id', component: SourceDetail },
    ],
  },
  { path: 'notfound', component: HelixNotfound },
  { path: '**', redirectTo: '/notfound' },
];
