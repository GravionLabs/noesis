import { Component, computed, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { HelixFormField, HelixValidators } from '@gravionlabs/helix';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { Button } from 'primeng/button';
import type { CreateSourceDto, Source, UpdateSourceDto } from '../../core/models/source.model';
import { SourcesStore } from '../../core/stores/sources.store';
import { CONFIG_TEMPLATES, IMPORTER_TYPES } from './config-templates';

const URL_PATTERN = /^https?:\/\/.+/i;

@Component({
  selector: 'app-source-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, HelixFormField, Dialog, InputText, Select, Textarea, Button],
  templateUrl: './source-form-dialog.html',
})
export class SourceFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(SourcesStore);

  readonly visible = input.required<boolean>();
  readonly source = input<Source | undefined>();
  readonly visibleChange = output<boolean>();
  readonly saved = output<void>();

  protected readonly importerTypes = IMPORTER_TYPES;
  protected readonly isEdit = computed(() => !!this.source());

  protected readonly form = this.fb.group({
    name: ['', HelixValidators.required('Name is required')],
    url: [
      '',
      [HelixValidators.required('URL is required'), HelixValidators.pattern('Must be a valid http(s) URL', URL_PATTERN)],
    ],
    importerType: ['llmstxt', HelixValidators.required('Importer type is required')],
    schedule: [''],
    config: [CONFIG_TEMPLATES['llmstxt']],
  });

  private lastTemplate = CONFIG_TEMPLATES['llmstxt'];

  constructor() {
    effect(() => {
      const source = this.source();
      if (source) {
        this.lastTemplate = CONFIG_TEMPLATES[source.importerType] ?? '{}';
        this.form.reset({
          name: source.name,
          url: source.url,
          importerType: source.importerType,
          schedule: source.schedule ?? '',
          config: source.config ?? this.lastTemplate,
        });
      } else {
        this.lastTemplate = CONFIG_TEMPLATES['llmstxt'];
        this.form.reset({
          name: '',
          url: '',
          importerType: 'llmstxt',
          schedule: '',
          config: this.lastTemplate,
        });
      }
    });

    this.form.controls.importerType.valueChanges.subscribe((type) => {
      const template = CONFIG_TEMPLATES[type ?? ''] ?? '{}';
      const currentConfig = this.form.controls.config.value ?? '';
      if (currentConfig.trim() === '' || currentConfig === this.lastTemplate) {
        this.form.controls.config.setValue(template);
      }
      this.lastTemplate = template;
    });
  }

  protected close(): void {
    this.visibleChange.emit(false);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const existing = this.source();

    if (existing) {
      const dto: UpdateSourceDto = {
        name: value.name ?? undefined,
        url: value.url ?? undefined,
        importerType: value.importerType ?? undefined,
        schedule: value.schedule || null,
        config: value.config || null,
      };
      this.store.updateSource(existing.id, dto);
    } else {
      const dto: CreateSourceDto = {
        name: value.name ?? '',
        url: value.url ?? '',
        importerType: value.importerType ?? undefined,
        schedule: value.schedule || undefined,
        config: value.config || undefined,
      };
      this.store.createSource(dto);
    }

    this.saved.emit();
    this.visibleChange.emit(false);
  }
}
