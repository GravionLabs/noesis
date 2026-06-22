import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { SourceFormDialog } from './source-form-dialog';
import { CONFIG_TEMPLATES } from './config-templates';
import type { Source } from '../../core/models/source.model';

const SOURCE: Source = {
  id: 's1',
  name: 'Test Source',
  url: 'https://example.com',
  importerType: 'github',
  enabled: true,
  config: '{}',
  schedule: null,
  lastImportedAt: null,
};

describe('SourceFormDialog', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourceFormDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function createComponent(source?: Source) {
    const fixture = TestBed.createComponent(SourceFormDialog);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('source', source);
    fixture.detectChanges();
    return fixture;
  }

  it('defaults to the llmstxt config template in create mode', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance['form'].controls.config.value).toBe(
      CONFIG_TEMPLATES['llmstxt'],
    );
  });

  it('populates the form from the source in edit mode', () => {
    const fixture = createComponent(SOURCE);
    const form = fixture.componentInstance['form'];
    expect(form.controls.name.value).toBe(SOURCE.name);
    expect(form.controls.url.value).toBe(SOURCE.url);
    expect(form.controls.importerType.value).toBe(SOURCE.importerType);
  });

  it('swaps the config template when importerType changes and config is untouched', () => {
    const fixture = createComponent();
    const form = fixture.componentInstance['form'];
    form.controls.importerType.setValue('crawler');
    expect(form.controls.config.value).toBe(CONFIG_TEMPLATES['crawler']);
  });

  it('does not overwrite a manually edited config on importerType change', () => {
    const fixture = createComponent();
    const form = fixture.componentInstance['form'];
    form.controls.config.setValue('{"custom":true}');
    form.controls.importerType.setValue('crawler');
    expect(form.controls.config.value).toBe('{"custom":true}');
  });

  it('does not submit an invalid form', () => {
    const fixture = createComponent();
    const form = fixture.componentInstance['form'];
    form.controls.name.setValue('');
    fixture.componentInstance['submit']();
    expect(form.controls.name.touched).toBe(true);
    httpTesting.expectNone(() => true);
  });

  it('creates a source on submit in create mode', () => {
    const fixture = createComponent();
    const form = fixture.componentInstance['form'];
    form.setValue({
      name: 'New Source',
      url: 'https://example.com/docs',
      importerType: 'llmstxt',
      schedule: '',
      config: '{}',
    });

    let saved = false;
    fixture.componentInstance.saved.subscribe(() => (saved = true));

    fixture.componentInstance['submit']();

    const req = httpTesting.expectOne('/api/sources');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.name).toBe('New Source');
    req.flush({ ...SOURCE, id: 's2', name: 'New Source' });

    expect(saved).toBe(true);
  });

  it('updates a source on submit in edit mode', () => {
    const fixture = createComponent(SOURCE);
    const form = fixture.componentInstance['form'];
    form.controls.name.setValue('Renamed Source');

    fixture.componentInstance['submit']();

    const req = httpTesting.expectOne('/api/sources/s1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.name).toBe('Renamed Source');
    req.flush({ ...SOURCE, name: 'Renamed Source' });
  });
});
