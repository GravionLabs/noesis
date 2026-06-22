import { type HelixRouteMenuItem, HelixEmpty } from '@gravionlabs/helix';

export const NOESIS_MENU_MODEL: HelixRouteMenuItem[] = [
  {
    label: 'Home',
    icon: 'pi pi-fw pi-home',
    items: [
      {
        label: 'Home',
        icon: 'pi pi-fw pi-home',
        path: '',
        component: HelixEmpty,
        breadcrumb: 'Home',
        routerLink: ['/'],
      },
    ],
  },
  {
    label: 'Knowledge Base',
    icon: 'pi pi-fw pi-database',
    items: [
      {
        label: 'Query',
        icon: 'pi pi-fw pi-search',
        path: 'query',
        component: HelixEmpty,
        breadcrumb: 'Query',
        routerLink: ['/query'],
      },
      {
        label: 'Jobs',
        icon: 'pi pi-fw pi-sync',
        path: 'jobs',
        component: HelixEmpty,
        breadcrumb: 'Jobs',
        routerLink: ['/jobs'],
      },
      {
        // Routed separately in app.routes.ts (sources list + detail share a
        // parent route so the detail page gets a real "Sources > Details"
        // breadcrumb trail) — no path/component here.
        label: 'Sources',
        icon: 'pi pi-fw pi-file',
        routerLink: ['/sources'],
      },
    ],
  },

  {
    label: 'Settings',
    icon: 'pi pi-fw pi-cog',
    path: 'settings',
    component: HelixEmpty,
    breadcrumb: 'Settings',
    routerLink: ['/settings'],
  },
];
