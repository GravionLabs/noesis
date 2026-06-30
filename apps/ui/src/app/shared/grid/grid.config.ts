import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

export const defaultColDef = {
  resizable: true,
  suppressMovable: true,
  sortable: true,
};
