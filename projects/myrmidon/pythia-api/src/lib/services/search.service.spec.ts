import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { DataPage, ErrorWrapper } from '@myrmidon/ngx-tools';

import {
  API_URL,
  emptyPage,
  expectUrl,
  failRequests,
  setupHttpTestBed,
} from '../testing/http-test-helpers';
import { KwicSearchResult, SearchService } from './search.service';

type SearchWrapper = ErrorWrapper<DataPage<KwicSearchResult>>;

describe('SearchService', () => {
  let service: SearchService;
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttpTestBed();
    service = TestBed.inject(SearchService);
  });

  afterEach(() => http.verify());

  describe('search', () => {
    it('should return an empty page without querying for empty query', () => {
      let result: SearchWrapper | undefined;
      service.search('', 5, 2, 10).subscribe((r) => (result = r));
      expect(result).toEqual({ value: emptyPage(2, 10) });
    });

    it('should return an empty page without querying for invalid paging', () => {
      let r1: SearchWrapper | undefined;
      let r2: SearchWrapper | undefined;
      service.search('[value="a"]', 5, 0, 10).subscribe((r) => (r1 = r));
      service.search('[value="a"]', 5, 1, 0).subscribe((r) => (r2 = r));
      expect(r1?.value?.total).toBe(0);
      expect(r2?.value?.total).toBe(0);
    });

    it('should search with defaults', () => {
      const wrapper: SearchWrapper = { value: emptyPage() };
      let result: SearchWrapper | undefined;
      service.search('[value="a"]').subscribe((r) => (result = r));
      const req = expectUrl(http, API_URL + 'search');
      const p = req.request.params;
      expect(p.get('query')).toBe('[value="a"]');
      expect(p.get('contextSize')).toBe('5');
      expect(p.get('pageNumber')).toBe('1');
      expect(p.get('pageSize')).toBe('20');
      expect(p.has('sortFields')).toBe(false);
      req.flush(wrapper);
      expect(result).toEqual(wrapper);
    });

    it('should pass each sort field as a sortFields param', () => {
      service.search('q', 3, 2, 50, ['author', '-title']).subscribe();
      const req = expectUrl(http, API_URL + 'search');
      expect(req.request.params.get('contextSize')).toBe('3');
      expect(req.request.params.get('pageNumber')).toBe('2');
      expect(req.request.params.get('pageSize')).toBe('50');
      expect(req.request.params.getAll('sortFields')).toEqual([
        'author',
        '-title',
      ]);
      req.flush({});
    });

    it('should emit an error message after retrying', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      let error: unknown;
      service.search('q').subscribe({ error: (e) => (error = e) });
      failRequests(http, API_URL + 'search', 4);
      expect(error).toBe('Server error: boom');
    });
  });

  describe('exportSearchResults', () => {
    it('should request CSV text with defaults', () => {
      let result: string | undefined;
      service.exportSearchResults('q').subscribe((r) => (result = r));
      const req = expectUrl(http, API_URL + 'search/csv');
      expect(req.request.responseType).toBe('text');
      const p = req.request.params;
      expect(p.get('query')).toBe('q');
      expect(p.get('pageSize')).toBe('100');
      expect(p.get('pageNumber')).toBe('1');
      expect(p.get('contextSize')).toBe('5');
      expect(p.has('lastPage')).toBe(false);
      req.flush('a,b\n1,2');
      expect(result).toBe('a,b\n1,2');
    });

    it('should pass last page when specified', () => {
      service.exportSearchResults('q', 10, 2, 4, 3).subscribe();
      const req = expectUrl(http, API_URL + 'search/csv');
      const p = req.request.params;
      expect(p.get('pageSize')).toBe('10');
      expect(p.get('pageNumber')).toBe('2');
      expect(p.get('lastPage')).toBe('4');
      expect(p.get('contextSize')).toBe('3');
      req.flush('');
    });
  });
});
