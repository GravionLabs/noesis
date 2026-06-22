
import { Component, computed, inject } from '@angular/core';
import { HelixAppLayout } from '@gravionlabs/helix';
import type { AlertItem, HelixStatusBarVersion, HelixTopbarItem } from '@gravionlabs/helix';
import { SettingsService } from '../core/services/settings.service';
import { NOESIS_MENU_MODEL } from './menu.model';

const NOESIS_BRAND_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
  <circle cx="12" cy="12" r="3" />
</svg>`;

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [HelixAppLayout],
  templateUrl: './app-shell.html',
})
export class AppShell {
  protected menu = NOESIS_MENU_MODEL;
  protected brandIcon = NOESIS_BRAND_ICON;

  protected versions: HelixStatusBarVersion[] = [{ label: 'Noesis', value: '0.1.0' }];

  private settings = inject(SettingsService);

  protected missingApiKeyAlert = computed<AlertItem | undefined>(() => {
    if (this.settings.hasApiKey()) return undefined;
    return {
      id: 'missing-api-key',
      label: 'API key not configured — some features may be unavailable',
      severity: 'warn',
    };
  });

  protected topbarItems = computed<HelixTopbarItem[]>(() => {
    const items: HelixTopbarItem[] = [
      { type: 'darkmode' },
      { type: 'configurator' },
      { type: 'mobile' },
    ];
    const alert = this.missingApiKeyAlert();
    if (alert) {
      items.push({ type: 'alert', badgeCount: 1, alerts: [alert] });
    }
    return items;
  });
}
