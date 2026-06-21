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
        label: 'Sources',
        icon: 'pi pi-fw pi-file',
        path: 'sources',
        component: HelixEmpty,
        breadcrumb: 'Sources',
        routerLink: ['/sources'],
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
        label: 'Query',
        icon: 'pi pi-fw pi-search',
        path: 'query',
        component: HelixEmpty,
        breadcrumb: 'Query',
        routerLink: ['/query'],
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
