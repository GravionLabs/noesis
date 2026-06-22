import { Component, input } from '@angular/core';

const importerLabels: Record<string, string> = {
  'llmstxt': 'LLMs.txt',
  'llmstxt-meta': 'LLMs.txt (Meta)',
  'llmstxt-crawl': 'LLMs.txt (Crawl)',
  'crawler': 'Crawler',
  'npm-readme': 'NPM README',
  'openapi': 'OpenAPI',
  'github': 'GitHub',
  'azuredevops': 'Azure DevOps',
};

@Component({
  selector: 'app-importer-type-badge',
  standalone: true,
  template: `
    <span class="importer-badge">
      {{ label() }}
    </span>
  `,
  styles: [
    `
    .importer-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
      background: #f3f4f6;
      color: #374151;
    }
    `,
  ],
})
export class ImporterTypeBadgeComponent {
  readonly type = input.required<string>();

  protected label(): string {
    return importerLabels[this.type()] ?? this.type();
  }
}
