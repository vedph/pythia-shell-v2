import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { DocumentService, ReaderService } from '@myrmidon/pythia-api';
import { Document, TextMapNode } from '@myrmidon/pythia-core';

import { DocumentReaderRepository } from './document-reader.repository';

function doc(id: number): Document {
  return {
    id,
    author: 'Homer',
    title: `Doc ${id}`,
    dateValue: 0,
    sortKey: '',
    source: '',
    profileId: 'p',
    lastModified: new Date(2020, 0, 1),
    attributes: [],
  };
}

function map(): TextMapNode {
  return {
    label: 'root',
    location: '/',
    start: 0,
    end: 10,
    children: [
      {
        label: 'a',
        location: '/a',
        start: 0,
        end: 5,
        children: [{ label: 'a1', location: '/a/1', start: 0, end: 2 }],
      },
    ],
  };
}

describe('DocumentReaderRepository', () => {
  let docService: { getDocument: ReturnType<typeof vi.fn> };
  let readService: {
    getDocumentMap: ReturnType<typeof vi.fn>;
    getDocumentPieceFromRange: ReturnType<typeof vi.fn>;
    getDocumentPieceFromPath: ReturnType<typeof vi.fn>;
  };
  let repo: DocumentReaderRepository;

  const state = () => {
    const s: {
      doc?: Document;
      map?: TextMapNode;
      text?: string;
      loading?: boolean;
    } = {};
    repo.document$.subscribe((d) => (s.doc = d));
    repo.map$.subscribe((m) => (s.map = m));
    repo.text$.subscribe((t) => (s.text = t));
    repo.loading$.subscribe((l) => (s.loading = l));
    return s;
  };

  beforeEach(() => {
    docService = { getDocument: vi.fn((id: number) => of(doc(id))) };
    readService = {
      getDocumentMap: vi.fn(() => of(map())),
      getDocumentPieceFromRange: vi.fn(() => of({ text: 'range text' })),
      getDocumentPieceFromPath: vi.fn(() => of({ text: 'path text' })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DocumentService, useValue: docService },
        { provide: ReaderService, useValue: readService },
      ],
    });
    repo = TestBed.inject(DocumentReaderRepository);
  });

  it('should load document and map setting node parents', () => {
    const s = state();
    repo.load({ documentId: 3 });
    expect(s.doc?.id).toBe(3);
    expect(repo.getDocumentId()).toBe(3);
    expect(s.map?.parent).toBeUndefined();
    expect(s.map?.children![0].parent).toBe(s.map);
    expect(s.map?.children![0].children![0].parent).toBe(s.map?.children![0]);
    expect(s.text).toBeUndefined();
    expect(s.loading).toBe(false);
    expect(readService.getDocumentPieceFromRange).not.toHaveBeenCalled();
  });

  it('should load the initial path', () => {
    const s = state();
    repo.load({ documentId: 3 }, '0.0');
    expect(readService.getDocumentPieceFromPath).toHaveBeenCalledWith(3, '0.0');
    expect(s.text).toBe('path text');
  });

  it('should load a range', () => {
    const s = state();
    repo.load({ documentId: 3, start: 10, end: 20 });
    expect(readService.getDocumentPieceFromRange).toHaveBeenCalledWith(3, 10, 20);
    expect(s.text).toBe('range text');
  });

  it('should load a range starting at 0', () => {
    const s = state();
    repo.load({ documentId: 3, start: 0, end: 5 });
    expect(readService.getDocumentPieceFromRange).toHaveBeenCalledWith(3, 0, 5);
    expect(s.text).toBe('range text');
  });

  it('should extract the body from a range text', () => {
    readService.getDocumentPieceFromRange.mockReturnValue(
      of({ text: '<html><body class="x"><p>hi</p></body></html>' }),
    );
    const s = state();
    repo.load({ documentId: 3, start: 1, end: 5 });
    expect(s.text).toBe('<p>hi</p>');
  });

  it('should stop loading and log on load error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    readService.getDocumentMap.mockReturnValue(throwError(() => 'boom'));
    const s = state();
    repo.load({ documentId: 3 });
    expect(s.loading).toBe(false);
    expect(s.doc).toBeUndefined();
    expect(spy).toHaveBeenCalled();
  });

  it('should discard a stale load response', () => {
    const slow = new Subject<Document>();
    docService.getDocument.mockReturnValueOnce(slow);
    const s = state();
    repo.load({ documentId: 1 });
    repo.load({ documentId: 2 });
    expect(s.doc?.id).toBe(2);
    slow.next(doc(1));
    slow.complete();
    expect(s.doc?.id).toBe(2);
  });

  it('should discard a pending load on reset', () => {
    const slow = new Subject<Document>();
    docService.getDocument.mockReturnValueOnce(slow);
    const s = state();
    repo.load({ documentId: 1 });
    expect(s.loading).toBe(true);
    repo.reset();
    expect(s.loading).toBe(false);
    slow.next(doc(1));
    slow.complete();
    expect(s.doc).toBeUndefined();
  });

  it('should reset document, map and text', () => {
    const s = state();
    repo.load({ documentId: 3, start: 1, end: 2 });
    repo.reset();
    expect(s.doc).toBeUndefined();
    expect(s.map).toBeUndefined();
    expect(s.text).toBeUndefined();
  });

  describe('loadTextFromPath', () => {
    it('should reject without document', async () => {
      await expect(repo.loadTextFromPath('0')).rejects.toBe(
        'No document loaded',
      );
    });

    it('should load text extracting body', async () => {
      readService.getDocumentPieceFromPath.mockReturnValue(
        of({ text: '<html>\n<head></head>\n<body>\n<p>x</p>\n</body>\n</html>' }),
      );
      const s = state();
      repo.load({ documentId: 3 });
      await expect(repo.loadTextFromPath('0.1')).resolves.toBe(true);
      expect(readService.getDocumentPieceFromPath).toHaveBeenCalledWith(3, '0.1');
      expect(s.text).toBe('\n<p>x</p>\n');
    });

    it('should keep text without body unchanged', async () => {
      readService.getDocumentPieceFromPath.mockReturnValue(of({ text: '<p>y</p>' }));
      const s = state();
      repo.load({ documentId: 3 });
      await repo.loadTextFromPath('0');
      expect(s.text).toBe('<p>y</p>');
    });

    it('should set empty text for null text', async () => {
      readService.getDocumentPieceFromPath.mockReturnValue(of({ text: null }));
      const s = state();
      repo.load({ documentId: 3 });
      await repo.loadTextFromPath('0');
      expect(s.text).toBe('');
    });

    it('should reject on error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      repo.load({ documentId: 3 });
      readService.getDocumentPieceFromPath.mockReturnValue(throwError(() => 'x'));
      const s = state();
      await expect(repo.loadTextFromPath('0.1')).rejects.toBe(
        'Error loading text from path "0.1"',
      );
      expect(s.loading).toBe(false);
    });
  });

  describe('loadTextFromRange', () => {
    it('should reject without document', async () => {
      await expect(repo.loadTextFromRange(0, 1)).rejects.toBe(
        'No document loaded',
      );
    });

    it('should load text', async () => {
      const s = state();
      repo.load({ documentId: 3 });
      await expect(repo.loadTextFromRange(5, 9)).resolves.toBe(true);
      expect(readService.getDocumentPieceFromRange).toHaveBeenCalledWith(3, 5, 9);
      expect(s.text).toBe('range text');
    });

    it('should reject on error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      repo.load({ documentId: 3 });
      readService.getDocumentPieceFromRange.mockReturnValue(throwError(() => 'x'));
      await expect(repo.loadTextFromRange(5, 9)).rejects.toBe(
        'Error loading text from 5-9',
      );
    });
  });
});
