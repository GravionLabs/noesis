import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Browse } from './browse';
import type { Source } from '../../core/models/source.model';
import type { SourceDoc, DocChunk } from '../../core/models/doc.model';

const SOURCE: Source = {
  id: 's1',
  name: 'Docs',
  url: 'https://example.com',
  importerType: 'llmstxt',
  enabled: true,
  config: null,
  schedule: null,
  lastImportedAt: null,
};

const DOCS: SourceDoc[] = [
  { id: 'd1', url: 'https://example.com/doc1', title: 'Doc One', chunkCount: 3 },
  { id: 'd2', url: 'https://example.com/doc2', title: 'Doc Two', chunkCount: 1 },
];

const CHUNKS: DocChunk[] = [
  {
    id: 'c1',
    docId: 'd1',
    sourceId: 's1',
    content: 'a'.repeat(500),
    heading: 'Intro',
    headingPath: ['Intro'],
    chunkIndex: 0,
    tokenCount: 10,
    createdAt: new Date().toISOString(),
  },
];

describe('Browse', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Browse],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  let fixture: any;

  afterEach(() => {
    httpTesting.verify();
    fixture?.destroy();
  });

  function createComponent() {
    fixture = TestBed.createComponent(Browse);
    fixture.detectChanges();
    httpTesting.expectOne('/api/sources').flush([SOURCE]);
    fixture.detectChanges();
    return fixture;
  }

  it('loads source options on init', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    expect(component['sourceOptions']()).toEqual([{ label: 'Docs', value: SOURCE }]);
  });

  it('loads docs when a source is selected', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['onSourceChange'](SOURCE);
    const req = httpTesting.expectOne('/api/sources/s1/docs');
    expect(req.request.method).toBe('GET');
    req.flush(DOCS);
    fixture.detectChanges();

    expect(component['docs']()).toEqual(DOCS);
    expect(component['loadingDocs']()).toBe(false);
  });

  it('loads chunks when a doc is selected', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['onSourceChange'](SOURCE);
    httpTesting.expectOne('/api/sources/s1/docs').flush(DOCS);
    fixture.detectChanges();

    component['onDocSelect'](DOCS[0]);
    const req = httpTesting.expectOne('/api/docs/d1/chunks');
    expect(req.request.method).toBe('GET');
    req.flush(CHUNKS);
    fixture.detectChanges();

    expect(component['chunks']()).toEqual(CHUNKS);
    expect(component['loadingChunks']()).toBe(false);
  });

  it('clears docs and chunks when source changes', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['onSourceChange'](SOURCE);
    httpTesting.expectOne('/api/sources/s1/docs').flush(DOCS);
    fixture.detectChanges();

    component['docs'].set(DOCS);
    component['selectedDoc'].set(DOCS[0]);
    component['chunks'].set(CHUNKS);

    component['onSourceChange'](SOURCE);
    // The second onSourceChange triggers another GET /api/sources/s1/docs
    httpTesting.expectOne('/api/sources/s1/docs').flush([]);
    fixture.detectChanges();

    expect(component['docs']()).toEqual([]);
    expect(component['selectedDoc']()).toBeUndefined();
    expect(component['chunks']()).toEqual([]);
  });

  it('toggles chunk expansion', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['toggleChunk']('c1');
    expect(component['expandedChunk']()).toBe('c1');

    component['toggleChunk']('c1');
    expect(component['expandedChunk']()).toBeUndefined();
  });
});
