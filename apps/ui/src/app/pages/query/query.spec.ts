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

const RESULT2: SearchResult = {
  chunkId: 'c2',
  sourceName: 'Docs',
  docTitle: 'Advanced Topics',
  docUrl: 'https://example.com/advanced',
  heading: 'Details',
  content: 'b'.repeat(300),
  score: 0.75,
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

  describe('multi-chunk selection (E-3)', () => {
    function createComponentWithResults() {
      const fixture = createComponent();
      const component = fixture.componentInstance;
      component['results'].set([RESULT, RESULT2]);
      return { fixture, component };
    }

    it('toggles chunk selection', () => {
      const { component } = createComponentWithResults();

      component['toggleSelect']('c1');
      expect(component['selectedChunkIds']()).toEqual(new Set(['c1']));
      expect(component['isSelected']('c1')).toBe(true);
      expect(component['selectedCount']()).toBe(1);

      component['toggleSelect']('c2');
      expect(component['selectedChunkIds']()).toEqual(new Set(['c1', 'c2']));
      expect(component['selectedCount']()).toBe(2);

      component['toggleSelect']('c1');
      expect(component['selectedChunkIds']()).toEqual(new Set(['c2']));
      expect(component['selectedCount']()).toBe(1);
    });

    it('estimates tokens based on content length', () => {
      const { component } = createComponentWithResults();

      component['toggleSelect']('c1');
      // 500 chars / 4 = 125
      expect(component['estimatedTokens']()).toBe(125);

      component['toggleSelect']('c2');
      // (500 + 300) / 4 = 200
      expect(component['estimatedTokens']()).toBe(200);
    });

    it('clears selection when clearSelection is called', () => {
      const { component } = createComponentWithResults();

      component['toggleSelect']('c1');
      component['toggleSelect']('c2');
      expect(component['selectedCount']()).toBe(2);

      component['clearSelection']();
      expect(component['selectedCount']()).toBe(0);
    });

    it('clears selection on new search', () => {
      const fixture = createComponent();
      const component = fixture.componentInstance;

      component['toggleSelect']('c1');
      expect(component['selectedCount']()).toBe(1);

      component['queryText'].set('new search');
      component['search']();
      httpTesting.expectOne((r) => r.url.startsWith('/api/search')).flush([RESULT]);
      fixture.detectChanges();

      expect(component['selectedCount']()).toBe(0);
    });

    it('copyContext fetches chunks and writes formatted content to clipboard', async () => {
      const fixture = createComponent();
      const component = fixture.componentInstance;
      component['results'].set([RESULT, RESULT2]);
      component['toggleSelect']('c1');
      component['toggleSelect']('c2');

      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const messageService = TestBed.inject(MessageService);
      const addSpy = vi.spyOn(messageService, 'add');

      component['copyContext']();

      const req1 = httpTesting.expectOne('/api/chunks/c1');
      req1.flush(CHUNK_DETAIL);

      const req2 = httpTesting.expectOne('/api/chunks/c2');
      req2.flush({
        ...CHUNK_DETAIL,
        id: 'c2',
        content: 'b'.repeat(300),
        doc: { url: 'https://example.com/advanced', title: 'Advanced Topics' },
      });

      await Promise.resolve();
      await Promise.resolve();

      expect(writeText).toHaveBeenCalled();
      const text = writeText.mock.calls[0][0] as string;
      expect(text).toContain('--- Source: Docs | Getting Started ---');
      expect(text).toContain('--- Source: Docs | Advanced Topics ---');
      expect(text).toContain('a'.repeat(500));
      expect(text).toContain('b'.repeat(300));
      expect(addSpy).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'Context copied!' }),
      );
    });
  });
});
