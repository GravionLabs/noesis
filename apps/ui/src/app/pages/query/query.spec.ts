import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Query } from './query';
import type { ChunkDetail } from '../../core/models/chunk.model';
import type { SearchResult } from '../../core/models/search.model';
import type { Source } from '../../core/models/source.model';

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

const CHUNK_DETAIL: ChunkDetail = {
  id: 'c1',
  content: 'a'.repeat(500),
  heading: 'Intro',
  headingPath: ['Intro'],
  chunkIndex: 0,
  doc: { url: 'https://example.com/start', title: 'Getting Started' },
  source: { id: 's1', name: 'Docs', type: 'llmstxt' },
};

const RESULT: SearchResult = {
  chunkId: 'c1',
  sourceName: 'Docs',
  docTitle: 'Getting Started',
  docUrl: 'https://example.com/start',
  heading: 'Intro',
  content: 'a'.repeat(500),
  score: 0.87,
};

describe('Query', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Query],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), MessageService],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(Query);
    fixture.detectChanges();
    httpTesting.expectOne('/api/sources').flush([SOURCE]);
    fixture.detectChanges();
    return fixture;
  }

  it('loads source options for the filter', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    expect(component['sourceOptions']()).toEqual([
      { label: 'All Sources', value: undefined },
      { label: 'Docs', value: 'Docs' },
    ]);
  });

  it('searches and renders results for a known term', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['queryText'].set('how do I configure');
    component['search']();

    const req = httpTesting.expectOne((r) => r.url.startsWith('/api/search'));
    expect(req.request.url).toContain('q=how');
    req.flush([RESULT]);
    fixture.detectChanges();

    expect(component['results']()).toEqual([RESULT]);
  });

  it('includes the source filter in the search request', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['queryText'].set('test');
    component['sourceFilter'].set('Docs');
    component['search']();

    const req = httpTesting.expectOne((r) => r.url.startsWith('/api/search'));
    expect(req.request.url).toContain('source=Docs');
    req.flush([RESULT]);
  });

  it('shows empty state when no results found', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['queryText'].set('nothing matches');
    component['search']();

    httpTesting.expectOne((r) => r.url.startsWith('/api/search')).flush([]);
    fixture.detectChanges();

    expect(component['hasSearched']()).toBe(true);
    expect(component['results']()).toEqual([]);
  });

  it('handles search errors gracefully', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['queryText'].set('test');
    component['search']();

    httpTesting
      .expectOne((r) => r.url.startsWith('/api/search'))
      .flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component['error']()).toBeTruthy();
  });

  it('copies chunk content to the clipboard and shows a success toast', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const messageService = TestBed.inject(MessageService);
    const addSpy = vi.spyOn(messageService, 'add');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    component['copyChunk']('hello world');
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('hello world');
    expect(addSpy).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: 'Copied!' }),
    );
  });

  it('opens and closes the full chunk dialog with detail from API', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['viewFullChunk'](RESULT);
    const req = httpTesting.expectOne('/api/chunks/c1');
    expect(req.request.method).toBe('GET');
    req.flush(CHUNK_DETAIL);
    fixture.detectChanges();

    expect(component['fullChunk']()).toEqual(CHUNK_DETAIL);

    component['closeFullChunk']();
    expect(component['fullChunk']()).toBeUndefined();
  });

  it('handles getChunk API error gracefully', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['viewFullChunk'](RESULT);
    const req = httpTesting.expectOne('/api/chunks/c1');
    req.flush({ error: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component['fullChunk']()).toBeUndefined();
    expect(component['loadingFullChunk']()).toBe(false);
  });
});
