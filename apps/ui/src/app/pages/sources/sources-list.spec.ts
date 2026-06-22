import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { MessageService, ConfirmationService } from 'primeng/api';
import { SourcesList } from './sources-list';
import type { Source } from '../../core/models/source.model';

const SOURCE: Source = {
  id: 's1',
  name: 'Test Source',
  url: 'https://example.com',
  importerType: 'llmstxt',
  enabled: true,
  config: null,
  schedule: null,
  lastImportedAt: null,
};

describe('SourcesList', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourcesList],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        MessageService,
        ConfirmationService,
      ],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(SourcesList);
    fixture.detectChanges();
    httpTesting.expectOne('/api/sources').flush([SOURCE]);
    fixture.detectChanges();
    return fixture;
  }

  it('loads sources on init', () => {
    const fixture = createComponent();
    expect(fixture.componentInstance['store'].sources()).toEqual([SOURCE]);
  });

  it('opens the create dialog with no editing source', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component['openCreate']();
    expect(component['dialogVisible']()).toBe(true);
    expect(component['editingSource']()).toBeUndefined();
  });

  it('opens the edit dialog with the selected source', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component['openEdit'](SOURCE);
    expect(component['dialogVisible']()).toBe(true);
    expect(component['editingSource']()).toEqual(SOURCE);
  });

  it('toggleEnabled patches the source via the store', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component['toggleEnabled'](SOURCE, false);

    const req = httpTesting.expectOne('/api/sources/s1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ enabled: false });
    req.flush({ ...SOURCE, enabled: false });
  });

  it('importNow triggers import and navigates to /jobs', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    component['importNow'](SOURCE);

    const req = httpTesting.expectOne('/api/sources/s1/import');
    expect(req.request.method).toBe('POST');
    req.flush({ jobId: 'j1', status: 'accepted' });

    expect(navigateSpy).toHaveBeenCalledWith(['/jobs']);
  });

  it('confirmDelete shows a confirmation before deleting', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const confirmationService = TestBed.inject(ConfirmationService);
    const confirmSpy = vi.spyOn(confirmationService, 'confirm');

    component['confirmDelete'](SOURCE);

    expect(confirmSpy).toHaveBeenCalledOnce();
    const config = confirmSpy.mock.calls[0][0];
    expect(config.message).toContain(SOURCE.name);

    config.accept?.();
    const req = httpTesting.expectOne('/api/sources/s1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
