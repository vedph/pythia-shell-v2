import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import {
  API_URL,
  emptyPage,
  expectUrl,
  failRequests,
  setupHttpTestBed,
} from '../testing/http-test-helpers';
import { Lemma, Word, WordService, WordSortOrder } from './word.service';

describe('WordService', () => {
  let service: WordService;
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttpTestBed();
    service = TestBed.inject(WordService);
  });

  afterEach(() => http.verify());

  describe('getDocAttributeInfo', () => {
    it('should request privileged attributes by default', () => {
      let result: unknown;
      service.getDocAttributeInfo().subscribe((r) => (result = r));
      const req = expectUrl(http, API_URL + 'words/doc-attr-info');
      expect(req.request.params.get('privileged')).toBe('true');
      req.flush([{ name: 'author', type: 0 }]);
      expect(result).toEqual([{ name: 'author', type: 0 }]);
    });

    it('should request non-privileged attributes', () => {
      service.getDocAttributeInfo(false).subscribe();
      const req = expectUrl(http, API_URL + 'words/doc-attr-info');
      expect(req.request.params.get('privileged')).toBe('false');
      req.flush([]);
    });
  });

  describe('getWords', () => {
    it('should use default paging and no filter params when empty', () => {
      service.getWords({}).subscribe();
      const req = expectUrl(http, API_URL + 'words');
      expect(req.request.params.keys().sort()).toEqual([
        'pageNumber',
        'pageSize',
      ]);
      req.flush(emptyPage());
    });

    it('should pass all filter params and mark items as words', () => {
      let items: Word[] = [];
      service
        .getWords(
          {
            language: 'ita',
            pos: 'NOUN',
            valuePattern: 'a*',
            minValueLength: 2,
            maxValueLength: 9,
            minCount: 3,
            maxCount: 99,
            sortOrder: WordSortOrder.ByReversedValue,
            isSortDescending: true,
            lemmaId: 7,
          },
          2,
          10,
        )
        .subscribe((p) => (items = p.items));
      const req = expectUrl(http, API_URL + 'words');
      const p = req.request.params;
      expect(p.get('pageNumber')).toBe('2');
      expect(p.get('pageSize')).toBe('10');
      expect(p.get('language')).toBe('ita');
      expect(p.get('pos')).toBe('NOUN');
      expect(p.get('valuePattern')).toBe('a*');
      expect(p.get('minValueLength')).toBe('2');
      expect(p.get('maxValueLength')).toBe('9');
      expect(p.get('minCount')).toBe('3');
      expect(p.get('maxCount')).toBe('99');
      expect(p.get('sortOrder')).toBe('2');
      expect(p.get('isSortDescending')).toBe('true');
      expect(p.get('lemmaId')).toBe('7');
      req.flush({
        items: [{ id: 1, value: 'casa', reversedValue: 'asac', count: 2 }],
        pageNumber: 2,
        pageSize: 10,
        pageCount: 1,
        total: 1,
      });
      expect(items.length).toBe(1);
      expect(items[0].type).toBe('word');
    });

    it('should emit an error message after retrying', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      let error: unknown;
      service.getWords({}).subscribe({ error: (e) => (error = e) });
      failRequests(http, API_URL + 'words', 4);
      expect(error).toBe('Server error: boom');
    });
  });

  describe('getLemmata', () => {
    it('should pass filter params and mark items as lemmata', () => {
      let items: Lemma[] = [];
      service
        .getLemmata({ language: 'lat', sortOrder: WordSortOrder.ByCount })
        .subscribe((p) => (items = p.items));
      const req = expectUrl(http, API_URL + 'lemmata');
      expect(req.request.params.get('language')).toBe('lat');
      expect(req.request.params.get('sortOrder')).toBe('3');
      expect(req.request.params.has('lemmaId')).toBe(false);
      req.flush({
        items: [{ id: 1, value: 'res', reversedValue: 'ser', count: 2 }],
        pageNumber: 1,
        pageSize: 20,
        pageCount: 1,
        total: 1,
      });
      expect(items[0].type).toBe('lemma');
    });

    it('should omit default sort order', () => {
      service.getLemmata({ sortOrder: WordSortOrder.Default }).subscribe();
      const req = expectUrl(http, API_URL + 'lemmata');
      expect(req.request.params.has('sortOrder')).toBe(false);
      req.flush(emptyPage());
    });
  });

  describe('counts', () => {
    it('should get word counts with repeated attributes', () => {
      const counts = {
        genre: [
          {
            sourceId: 5,
            attributeName: 'genre',
            attributeValue: 'epic',
            value: 3,
          },
        ],
      };
      let result: unknown;
      service
        .getWordCounts(5, ['genre', 'period'])
        .subscribe((r) => (result = r));
      const req = expectUrl(http, API_URL + 'words/5/counts');
      expect(req.request.params.getAll('attributes')).toEqual([
        'genre',
        'period',
      ]);
      req.flush(counts);
      expect(result).toEqual(counts);
    });

    it('should get lemma counts with repeated attributes', () => {
      service.getLemmaCounts(6, ['genre']).subscribe();
      const req = expectUrl(http, API_URL + 'lemmata/6/counts');
      expect(req.request.params.getAll('attributes')).toEqual(['genre']);
      req.flush({});
    });
  });
});
