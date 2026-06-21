import { Component } from '@angular/core';
import { HelixAppLayout } from '@gravionlabs/helix';
import type { HelixStatusBarVersion } from '@gravionlabs/helix';
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
}
