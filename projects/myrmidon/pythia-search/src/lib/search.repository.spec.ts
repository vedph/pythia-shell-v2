import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { DataPage, ErrorWrapper } from '@myrmidon/ngx-tools';
import { KwicSearchResult, SearchService } from '@myrmidon/pythia-api';
import { DocumentReadRequest } from '@myrmidon/pythia-core';

import { SearchRepository } from './search.repository';

function result(i: number): KwicSearchResult {
  return {
    id: `${i}`,
    documentId: 1,
    p1: i,
    p2: i,
    index: i * 10,
    length: 4,
    type: 'tok',
    value: `w${i}`,
    author: 'A',
    title: 'T',
    sortKey: '',
    text: `w${i}`,
    leftContext: [],
    rightContext: [],
  };
}

function wrap(pageNumber: number, pageSize: number, total = 30) {
  const items: KwicSearchResult[] = [];
  for (
    let i = (pageNumber - 1) * pageSize;
    i < Math.min(total, pageNumber * pageSize);
    i++
  ) {
    items.push(result(i));
  }
  return of<ErrorWrapper<DataPage<KwicSearchResult>>>({
    value: {
      items,
      pageNumber,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
      total,
    },
  });
}

describe('SearchRepository', () => {
  let searchService: { search: ReturnType<typeof vi.fn> };
  let repo: SearchRepository;

  const state = () => {
    const s: {
      query?: string;
      prevQuery?: string;
      error?: string;
      loading?: boolean;
      page?: DataPage<KwicSearchResult>;
      history?: string[];
      read?: DocumentReadRequest;
    } = {};
    repo.query$.subscribe((q) => (s.query = q));
    repo.prevQuery$.subscribe((q) => (s.prevQuery = q));
    repo.error$.subscribe((e) => (s.error = e));
    repo.loading$.subscribe((l) => (s.loading = l));
    repo.page$.subscribe((p) => (s.page = p));
    repo.lastQueries$.subscribe((h) => (s.history = h));
    repo.readRequest$.subscribe((r) => (s.read = r));
    return s;
  };

  beforeEach(() => {
    searchService = {
      search: vi.fn((_q: string, _c: number, n: number, s: number) =>
        wrap(n, s),
      ),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: SearchService, useValue: searchService }],
    });
    repo = TestBed.inject(SearchRepository);
  });

  it('should search with default context size', async () => {
    const s = state();
    repo.setFilter({ query: '[value="a"]' });
    await Promise.resolve();
    expect(searchService.search).toHaveBeenCalledWith('[value="a"]', 5, 1, 20);
    expect(s.page?.items.length).toBe(20);
    expect(s.query).toBe('[value="a"]');
    expect(s.prevQuery).toBe('[value="a"]');
    expect(s.loading).toBe(false);
  });

  it('should toggle loading while searching', () => {
    const response = new Subject<ErrorWrapper<DataPage<KwicSearchResult>>>();
    searchService.search.mockReturnValue(response);
    const s = state();
    repo.setFilter({ query: 'q' });
    expect(s.loading).toBe(true);
    response.next({ value: { items: [], pageNumber: 1, pageSize: 20, pageCount: 0, total: 0 } });
    response.complete();
    expect(s.loading).toBe(false);
  });

  it('should pass a custom context size', () => {
    repo.setFilter({ query: 'q', contextSize: 3 });
    expect(searchService.search).toHaveBeenCalledWith('q', 3, 1, 20);
  });

  it('should report query errors with an empty page', () => {
    searchService.search.mockReturnValue(of({ error: 'syntax error' }));
    const s = state();
    repo.setFilter({ query: 'bad' });
    expect(s.error).toBe('syntax error');
    expect(s.page?.items).toEqual([]);
  });

  it('should report request errors and stop loading', async () => {
    searchService.search.mockReturnValue(
      throwError(() => 'Server error: boom'),
    );
    const s = state();
    repo.setFilter({ query: 'q' });
    await Promise.resolve();
    expect(s.loading).toBe(false);
    expect(s.error).toBe('Server error: boom');
  });

  it('should clear error on new search', () => {
    searchService.search.mockReturnValueOnce(of({ error: 'syntax error' }));
    const s = state();
    repo.setFilter({ query: 'bad' });
    repo.setFilter({ query: 'good' });
    expect(s.error).toBeUndefined();
  });

  it('should use previous query when filter has none', () => {
    repo.setFilter({ query: 'q1' });
    repo.clear();
    searchService.search.mockClear();
    repo.loadPage(2, 10, {}).subscribe();
    expect(searchService.search).toHaveBeenCalledWith('q1', 5, 2, 10);
  });

  it('should return an empty page without any query', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let page: DataPage<KwicSearchResult> | undefined;
    repo.loadPage(1, 20, {}).subscribe((p) => (page = p));
    expect(page?.total).toBe(0);
    expect(searchService.search).not.toHaveBeenCalled();
  });

  it('should set page', () => {
    repo.setFilter({ query: 'q' });
    repo.setPage(2, 20);
    expect(searchService.search).toHaveBeenLastCalledWith('q', 5, 2, 20);
  });

  it('should reload pages when the page size changes', () => {
    const s = state();
    repo.setFilter({ query: 'q' });
    repo.setPage(1, 5);
    expect(searchService.search).toHaveBeenLastCalledWith('q', 5, 1, 5);
    expect(s.page?.items.length).toBe(5);
  });

  it('should clear results moving query to previous query', () => {
    const s = state();
    repo.setFilter({ query: 'q' });
    repo.setReadRequest({ documentId: 1 });
    repo.clear();
    expect(s.page?.items).toEqual([]);
    expect(s.query).toBeUndefined();
    expect(s.prevQuery).toBe('q');
    expect(s.read).toBeUndefined();
    expect(s.error).toBeUndefined();
  });

  it('should reset the store', () => {
    repo.setFilter({ query: 'q' });
    searchService.search.mockClear();
    repo.reset();
    // reset filter has no query: the previous one is used
    expect(searchService.search).toHaveBeenCalledWith('q', 5, 1, 20);
  });

  it('should add unique queries to history, latest first', () => {
    const s = state();
    repo.addToHistory('a');
    repo.addToHistory('b');
    repo.addToHistory('a');
    expect(s.history).toEqual(['b', 'a']);
  });

  it('should set read request', () => {
    const s = state();
    repo.setReadRequest({ documentId: 3, start: 0, end: 4 });
    expect(s.read).toEqual({ documentId: 3, start: 0, end: 4 });
  });
});
