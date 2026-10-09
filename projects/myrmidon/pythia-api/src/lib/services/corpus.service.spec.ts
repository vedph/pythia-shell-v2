import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Corpus } from '@myrmidon/pythia-core';

import {
  API_URL,
  emptyPage,
  expectUrl,
  failRequests,
  setupHttpTestBed,
} from '../testing/http-test-helpers';
import { CorpusService } from './corpus.service';

describe('CorpusService', () => {
  let service: CorpusService;
  let http: HttpTestingController;

  const corpus: Corpus = { id: 'c1', title: 'Alpha', description: 'First' };

  beforeEach(() => {
    http = setupHttpTestBed();
    service = TestBed.inject(CorpusService);
  });

  afterEach(() => http.verify());

  describe('getCorpora', () => {
    it('should use default paging and no filter params when empty', () => {
      service.getCorpora({}).subscribe();
      const req = expectUrl(http, API_URL + 'corpora');
      expect(req.request.params.keys().sort()).toEqual([
        'pageNumber',
        'pageSize',
      ]);
      expect(req.request.params.get('pageNumber')).toBe('1');
      expect(req.request.params.get('pageSize')).toBe('20');
      req.flush(emptyPage());
    });

    it('should pass all filter params', () => {
      let items: Corpus[] = [];
      service
        .getCorpora(
          { id: 'c', title: 'al', prefix: 'p', userId: 'zeus', counts: true },
          3,
          5,
        )
        .subscribe((p) => (items = p.items));
      const req = expectUrl(http, API_URL + 'corpora');
      const p = req.request.params;
      expect(p.get('pageNumber')).toBe('3');
      expect(p.get('pageSize')).toBe('5');
      expect(p.get('id')).toBe('c');
      expect(p.get('title')).toBe('al');
      expect(p.get('prefix')).toBe('p');
      expect(p.get('userId')).toBe('zeus');
      expect(p.get('counts')).toBe('true');
      req.flush({
        items: [corpus],
        pageNumber: 3,
        pageSize: 5,
        pageCount: 3,
        total: 11,
      });
      expect(items).toEqual([corpus]);
    });

    it('should emit an error message after retrying', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      let error: unknown;
      service.getCorpora({}).subscribe({ error: (e) => (error = e) });
      failRequests(http, API_URL + 'corpora', 4);
      expect(error).toBe('Server error: boom');
    });
  });

  describe('getCorpus', () => {
    it('should get corpus with document IDs', () => {
      let result: Corpus | undefined;
      service.getCorpus('c1', false).subscribe((c) => (result = c));
      const req = expectUrl(http, API_URL + 'corpora/c1');
      expect(req.request.params.has('noDocumentIds')).toBe(false);
      req.flush(corpus);
      expect(result).toEqual(corpus);
    });

    it('should request no document IDs when specified', () => {
      service.getCorpus('c1', true).subscribe();
      const req = expectUrl(http, API_URL + 'corpora/c1');
      expect(req.request.params.get('noDocumentIds')).toBe('true');
      req.flush(corpus);
    });
  });

  describe('addCorpus', () => {
    it('should post corpus with source ID', () => {
      let result: Corpus | undefined;
      service.addCorpus(corpus, 'src').subscribe((c) => (result = c));
      const req = expectUrl(http, API_URL + 'corpora', 'POST');
      expect(req.request.body).toEqual({ ...corpus, sourceId: 'src' });
      req.flush(corpus);
      expect(result).toEqual(corpus);
    });

    it('should not retry on error', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      let error: unknown;
      service.addCorpus(corpus).subscribe({ error: (e) => (error = e) });
      failRequests(http, API_URL + 'corpora', 1);
      expect(error).toBe('Server error: boom');
    });
  });

  it('should put filter to add documents', () => {
    service.addDocumentsByFilter('c1', { author: 'Homer' }).subscribe();
    const req = expectUrl(http, API_URL + 'corpora/c1/add', 'PUT');
    expect(req.request.body).toEqual({ author: 'Homer' });
    req.flush(null);
  });

  it('should put filter to remove documents', () => {
    service.removeDocumentsByFilter('c1', { title: 'Iliad' }).subscribe();
    const req = expectUrl(http, API_URL + 'corpora/c1/del', 'PUT');
    expect(req.request.body).toEqual({ title: 'Iliad' });
    req.flush(null);
  });

  it('should delete corpus', () => {
    let done = false;
    service.deleteCorpus('c1').subscribe(() => (done = true));
    expectUrl(http, API_URL + 'corpora/c1', 'DELETE').flush(null);
    expect(done).toBe(true);
  });
});
