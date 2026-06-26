import { type HelixRouteMenuItem } from '@gravionlabs/helix';
import { Dashboard } from '../pages/dashboard/dashboard';

export const NOESIS_MENU_MODEL: HelixRouteMenuItem[] = [
  {
    label: 'Home',
    icon: 'pi pi-fw pi-home',
    items: [
      {
        label: 'Dashboard',
        icon: 'pi pi-fw pi-home',
        path: '',
        component: Dashboard,
        breadcrumb: 'Dashboard',
        routerLink: ['/'],
      },
    ],
  },
  {
    // Routed separately in app.routes.ts as a componentless 'Knowledge Base'
    // parent route, so Query/Jobs/Sources all get a real
    // "Knowledge Base > ..." breadcrumb trail matching this nav grouping.
    // `path` (no `component`) is kept here even though helixRoutesFrom
    // won't generate a route from it — HelixNavRailItem.isActive requires
    // item().path to compute the active highlight, and a path with no
    // component is safely skipped (not recursed into a duplicate route).
    label: 'Knowledge Base',
    icon: 'pi pi-fw pi-database',
    items: [
      {
        label: 'Query',
        icon: 'pi pi-fw pi-search',
        path: 'query',
        routerLink: ['/query'],
      },
      {
        label: 'Jobs',
        icon: 'pi pi-fw pi-sync',
        path: 'jobs',
        routerLink: ['/jobs'],
      },
      {
        label: 'Sources',
        icon: 'pi pi-fw pi-file',
        path: 'sources',
        routerLink: ['/sources'],
      },
    ],
  },

  {
    label: 'Settings',
    icon: 'pi pi-fw pi-cog',
    path: 'settings',
    breadcrumb: 'Settings',
    routerLink: ['/settings'],
  },
];
