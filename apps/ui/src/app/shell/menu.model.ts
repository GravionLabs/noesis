import { type HelixRouteMenuItem, HelixEmpty } from '@gravionlabs/helix';
import { SourcesList } from '../pages/sources/sources-list';

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
        label: 'Sources',
        icon: 'pi pi-fw pi-file',
        path: 'sources',
        component: SourcesList,
        breadcrumb: 'Sources',
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
