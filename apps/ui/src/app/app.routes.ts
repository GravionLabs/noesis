import type { Routes } from '@angular/router';
import { helixRoutesFrom } from '@gravionlabs/helix';
import { AppShell } from './shell/app-shell';
import { NOESIS_MENU_MODEL } from './shell/menu.model';

export const routes: Routes = [
  {
    path: '',
    component: AppShell,
    children: helixRoutesFrom(NOESIS_MENU_MODEL),
  },
];
