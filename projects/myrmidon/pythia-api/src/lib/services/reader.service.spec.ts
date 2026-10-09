import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { TextMapNode } from '@myrmidon/pythia-core';

import {
  API_URL,
  expectUrl,
  failRequests,
  setupHttpTestBed,
} from '../testing/http-test-helpers';
import { ReaderService } from './reader.service';

function node(label: string, children: TextMapNode[] = []): TextMapNode {
  const n: TextMapNode = { label, location: label, start: 0, end: 0, children };
  children.forEach((c) => (c.parent = n));
  return n;
}

describe('ReaderService', () => {
  let service: ReaderService;
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttpTestBed();
    service = TestBed.inject(ReaderService);
  });

  afterEach(() => http.verify());

  it('should get document map', () => {
    const root = node('root');
    let result: TextMapNode | undefined;
    service.getDocumentMap(3).subscribe((n) => (result = n));
    expectUrl(http, API_URL + 'documents/3/map').flush(root);
    expect(result).toEqual(root);
  });

  it('should get document text', () => {
    let result: string | undefined;
    service.getDocumentText(3).subscribe((t) => (result = t));
    expectUrl(http, API_URL + 'documents/3/text').flush('hello');
    expect(result).toBe('hello');
  });

  it('should get document piece from path', () => {
    let result: { text: string } | undefined;
    service.getDocumentPieceFromPath(3, '0.1.2').subscribe((p) => (result = p));
    expectUrl(http, API_URL + 'documents/3/path/0.1.2').flush({ text: 'x' });
    expect(result).toEqual({ text: 'x' });
  });

  it('should get document piece from range', () => {
    let result: { text: string } | undefined;
    service.getDocumentPieceFromRange(3, 10, 20).subscribe((p) => (result = p));
    expectUrl(http, API_URL + 'documents/3/range/10/20').flush({ text: 'y' });
    expect(result).toEqual({ text: 'y' });
  });

  it('should emit an error message after retrying', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let error: unknown;
    service.getDocumentMap(9).subscribe({ error: (e) => (error = e) });
    failRequests(http, API_URL + 'documents/9/map', 4);
    expect(error).toBe('Server error: boom');
  });

  describe('getNodePath', () => {
    // root
    // +-- a (0)
    // +-- b (1)
    //     +-- b0 (0)
    //     +-- b1 (1)
    //     +-- b2 (2)
    //         +-- b2a (0)
    const b2a = node('b2a');
    const b2 = node('b2', [b2a]);
    const b = node('b', [node('b0'), node('b1'), b2]);
    const a = node('a');
    const root = node('root', [a, b]);

    it('should return 0 for root', () => {
      expect(service.getNodePath(root)).toBe('0');
    });

    it('should return path for root children', () => {
      expect(service.getNodePath(a)).toBe('0.0');
      expect(service.getNodePath(b)).toBe('0.1');
    });

    it('should return path from root down to a deep node', () => {
      expect(service.getNodePath(b2)).toBe('0.1.2');
      expect(service.getNodePath(b2a)).toBe('0.1.2.0');
    });
  });
});
