import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Document } from '@myrmidon/pythia-core';

import {
  API_URL,
  emptyPage,
  expectUrl,
  failRequests,
  setupHttpTestBed,
} from '../testing/http-test-helpers';
import { DocumentService, DocumentSortOrder } from './document.service';

describe('DocumentService', () => {
  let service: DocumentService;
  let http: HttpTestingController;

  const doc: Document = {
    id: 1,
    author: 'Homer',
    title: 'Iliad',
    dateValue: -750,
    sortKey: 'homeriliad',
    source: 'iliad.xml',
    profileId: 'p',
    lastModified: new Date(2020, 0, 1),
    attributes: [],
  };

  beforeEach(() => {
    http = setupHttpTestBed();
    service = TestBed.inject(DocumentService);
  });

  afterEach(() => http.verify());

  describe('getDocuments', () => {
    it('should use default paging and no filter params when empty', () => {
      service.getDocuments({}).subscribe();
      const req = expectUrl(http, API_URL + 'documents');
      expect(req.request.params.keys().sort()).toEqual([
        'pageNumber',
        'pageSize',
      ]);
      expect(req.request.params.get('pageNumber')).toBe('1');
      expect(req.request.params.get('pageSize')).toBe('20');
      req.flush(emptyPage());
    });

    it('should pass all filter params', () => {
      const min = new Date(Date.UTC(2020, 0, 2, 3, 4, 5));
      const max = new Date(Date.UTC(2021, 5, 6, 7, 8, 9));
      let items: Document[] = [];
      service
        .getDocuments(
          {
            corpusId: 'c1',
            author: 'Homer',
            title: 'Iliad',
            source: 'src',
            profileId: 'prof',
            minDateValue: -800,
            maxDateValue: 200,
            minTimeModified: min,
            maxTimeModified: max,
            attributes: 'genre=epic',
            sortOrder: DocumentSortOrder.Title,
            descending: true,
          },
          2,
          10,
        )
        .subscribe((p) => (items = p.items));
      const req = expectUrl(http, API_URL + 'documents');
      const p = req.request.params;
      expect(p.get('pageNumber')).toBe('2');
      expect(p.get('pageSize')).toBe('10');
      expect(p.get('corpusId')).toBe('c1');
      expect(p.get('author')).toBe('Homer');
      expect(p.get('title')).toBe('Iliad');
      expect(p.get('source')).toBe('src');
      expect(p.get('profileId')).toBe('prof');
      expect(p.get('minDateValue')).toBe('-800');
      expect(p.get('maxDateValue')).toBe('200');
      // ISO format so that the backend can bind it to a DateTime
      expect(p.get('minTimeModified')).toBe('2020-01-02T03:04:05.000Z');
      expect(p.get('maxTimeModified')).toBe('2021-06-06T07:08:09.000Z');
      expect(p.get('attributes')).toBe('genre=epic');
      expect(p.get('sort')).toBe('2');
      expect(p.get('descending')).toBe('true');
      req.flush({
        items: [doc],
        pageNumber: 2,
        pageSize: 10,
        pageCount: 1,
        total: 1,
      });
      expect(items).toEqual([doc]);
    });

    it('should omit default sort order and empty attributes', () => {
      service
        .getDocuments({ sortOrder: DocumentSortOrder.Default, attributes: '' })
        .subscribe();
      const req = expectUrl(http, API_URL + 'documents');
      expect(req.request.params.has('sort')).toBe(false);
      expect(req.request.params.has('attributes')).toBe(false);
      req.flush(emptyPage());
    });

    it('should emit an error message after retrying', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      let error: unknown;
      service.getDocuments({}).subscribe({ error: (e) => (error = e) });
      failRequests(http, API_URL + 'documents', 4);
      expect(error).toBe('Server error: boom');
    });
  });

  describe('getDocument', () => {
    it('should get document without content by default', () => {
      let result: Document | undefined;
      service.getDocument(1).subscribe((d) => (result = d));
      const req = expectUrl(http, API_URL + 'documents/1');
      expect(req.request.params.has('content')).toBe(false);
      req.flush(doc);
      expect(result).toEqual(doc);
    });

    it('should request content when specified', () => {
      service.getDocument(1, true).subscribe();
      const req = expectUrl(http, API_URL + 'documents/1');
      expect(req.request.params.get('content')).toBe('true');
      req.flush(doc);
    });
  });
});
