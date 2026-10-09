import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import {
  API_URL,
  emptyPage,
  expectUrl,
  failRequests,
  setupHttpTestBed,
} from '../testing/http-test-helpers';
import { TermService, TermSortOrder } from './term.service';

describe('TermService', () => {
  let service: TermService;
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttpTestBed();
    service = TestBed.inject(TermService);
  });

  afterEach(() => http.verify());

  describe('getTerms', () => {
    it('should use default paging and no filter params when empty', () => {
      service.getTerms({}).subscribe();
      const req = expectUrl(http, API_URL + 'terms');
      expect(req.request.params.keys().sort()).toEqual([
        'pageNumber',
        'pageSize',
      ]);
      req.flush(emptyPage());
    });

    it('should pass all filter params', () => {
      service
        .getTerms(
          {
            corpusId: 'c',
            author: 'a',
            title: 't',
            source: 's',
            profileId: 'p',
            minDateValue: 1,
            maxDateValue: 2,
            minTimeModified: new Date(Date.UTC(2020, 0, 1)),
            maxTimeModified: new Date(Date.UTC(2020, 11, 31)),
            docAttributes: 'x=1',
            occAttributes: 'y=2',
            valuePattern: 'a*',
            minValueLength: 2,
            maxValueLength: 9,
            minCount: 3,
            maxCount: 99,
            sortOrder: TermSortOrder.ByCount,
            descending: true,
          },
          4,
          8,
        )
        .subscribe();
      const req = expectUrl(http, API_URL + 'terms');
      const p = req.request.params;
      expect(p.get('pageNumber')).toBe('4');
      expect(p.get('pageSize')).toBe('8');
      expect(p.get('corpusId')).toBe('c');
      expect(p.get('author')).toBe('a');
      expect(p.get('title')).toBe('t');
      expect(p.get('source')).toBe('s');
      expect(p.get('profileId')).toBe('p');
      expect(p.get('minDateValue')).toBe('1');
      expect(p.get('maxDateValue')).toBe('2');
      expect(p.get('minTimeModified')).toBe('2020-01-01T00:00:00.000Z');
      expect(p.get('maxTimeModified')).toBe('2020-12-31T00:00:00.000Z');
      expect(p.get('docAttributes')).toBe('x=1');
      expect(p.get('occAttributes')).toBe('y=2');
      expect(p.get('valuePattern')).toBe('a*');
      expect(p.get('minValueLength')).toBe('2');
      expect(p.get('maxValueLength')).toBe('9');
      expect(p.get('minCount')).toBe('3');
      expect(p.get('maxCount')).toBe('99');
      expect(p.get('sortOrder')).toBe('3');
      expect(p.get('descending')).toBe('true');
      req.flush(emptyPage(4, 8));
    });
  });

  describe('getTermDistributions', () => {
    it('should pass only term ID and limit for a minimal request', () => {
      service
        .getTermDistributions({ termId: 1, limit: 10, interval: 1 })
        .subscribe();
      const req = expectUrl(http, API_URL + 'terms/distributions');
      expect(req.request.params.keys().sort()).toEqual(['limit', 'termId']);
      req.flush({});
    });

    it('should pass interval and repeated attributes', () => {
      service
        .getTermDistributions({
          termId: 1,
          limit: 10,
          interval: 5,
          docAttributes: ['a', 'b'],
          occAttributes: ['c'],
        })
        .subscribe();
      const req = expectUrl(http, API_URL + 'terms/distributions');
      const p = req.request.params;
      expect(p.get('interval')).toBe('5');
      expect(p.getAll('docAttributes')).toEqual(['a', 'b']);
      expect(p.getAll('occAttributes')).toEqual(['c']);
      req.flush({});
    });

    it('should emit an error message after retrying', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      let error: unknown;
      service
        .getTermDistributions({ termId: 1, limit: 1 })
        .subscribe({ error: (e) => (error = e) });
      failRequests(http, API_URL + 'terms/distributions', 4);
      expect(error).toBe('Server error: boom');
    });
  });
});
