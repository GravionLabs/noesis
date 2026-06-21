import { Component, computed, inject } from '@angular/core';
import { HelixAppLayout } from '@gravionlabs/helix';
import type { AlertItem, HelixStatusBarVersion } from '@gravionlabs/helix';
import { SettingsService } from '../core/services/settings.service';
import { NOESIS_MENU_MODEL } from './menu.model';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [HelixAppLayout],
  templateUrl: './app-shell.html',
})
export class AppShell {
  protected menu = NOESIS_MENU_MODEL;

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

  protected alertCount = computed(() => (this.missingApiKeyAlert() ? 1 : 0));

  protected alerts = computed<AlertItem[]>(() => {
    const alert = this.missingApiKeyAlert();
    return alert ? [alert] : [];
  });
}
