import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import {
  AttributeService,
  DocumentFilter,
  DocumentService,
  ProfileService,
} from '@myrmidon/pythia-api';
import { Document } from '@myrmidon/pythia-core';

import { DocumentRepository } from './document.repository';

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

function pageOf(pageNumber: number, pageSize: number, total = 30) {
  const items: Document[] = [];
  for (let i = (pageNumber - 1) * pageSize; i < Math.min(total, pageNumber * pageSize); i++) {
    items.push(doc(i + 1));
  }
  return {
    items,
    pageNumber,
    pageSize,
    pageCount: Math.ceil(total / pageSize),
    total,
  };
}

describe('DocumentRepository', () => {
  let docService: {
    getDocuments: ReturnType<typeof vi.fn>;
    getDocument: ReturnType<typeof vi.fn>;
  };
  let attrService: { getAttributeNames: ReturnType<typeof vi.fn> };
  let profileService: { getProfiles: ReturnType<typeof vi.fn> };

  function create(): DocumentRepository {
    TestBed.configureTestingModule({
      providers: [
        { provide: DocumentService, useValue: docService },
        { provide: AttributeService, useValue: attrService },
        { provide: ProfileService, useValue: profileService },
      ],
    });
    return TestBed.inject(DocumentRepository);
  }

  beforeEach(() => {
    docService = {
      getDocuments: vi.fn((_f: DocumentFilter, n: number, s: number) =>
        of(pageOf(n, s)),
      ),
      getDocument: vi.fn((id: number) => of(doc(id))),
    };
    attrService = {
      getAttributeNames: vi.fn().mockReturnValue(
        of({ items: ['genre', 'period'], pageNumber: 1, pageSize: 0, pageCount: 1, total: 2 }),
      ),
    };
    profileService = {
      getProfiles: vi.fn().mockReturnValue(
        of({ items: [{ id: 'p1' }, { id: 'p2' }], pageNumber: 1, pageSize: 0, pageCount: 1, total: 2 }),
      ),
    };
  });

  it('should load lookup data and the first page on creation', () => {
    const repo = create();
    expect(attrService.getAttributeNames).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: 0,
      type: 0,
    });
    expect(profileService.getProfiles).toHaveBeenCalledWith(
      { prefix: undefined },
      1,
      0,
      true,
    );
    expect(docService.getDocuments).toHaveBeenCalledWith({}, 1, 20);

    let attributes: string[] = [];
    let profileIds: string[] = [];
    let items: Document[] = [];
    repo.attributes$.subscribe((a) => (attributes = a));
    repo.profileIds$.subscribe((p) => (profileIds = p));
    repo.page$.subscribe((p) => (items = p.items));
    expect(attributes).toEqual(['genre', 'period']);
    expect(profileIds).toEqual(['p1', 'p2']);
    expect(items.length).toBe(20);
  });

  it('should load lookup with profile prefix', () => {
    const repo = create();
    repo.loadLookup('xml-');
    expect(profileService.getProfiles).toHaveBeenLastCalledWith(
      { prefix: 'xml-' },
      1,
      0,
      true,
    );
  });

  it('should log lookup errors and stop loading', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    attrService.getAttributeNames.mockReturnValue(throwError(() => 'boom'));
    const repo = create();
    let loading = true;
    repo.loading$.subscribe((l) => (loading = l));
    expect(spy).toHaveBeenCalled();
    expect(loading).toBe(false);
  });

  it('should toggle loading while loading a page', () => {
    const repo = create();
    const response = new Subject<ReturnType<typeof pageOf>>();
    docService.getDocuments.mockReturnValue(response);
    const states: boolean[] = [];
    repo.loading$.subscribe((l) => states.push(l));
    repo.setFilter({ author: 'x' });
    expect(states[states.length - 1]).toBe(true);
    response.next(pageOf(1, 20));
    response.complete();
    expect(states[states.length - 1]).toBe(false);
  });

  it('should set filter and load its first page', async () => {
    const repo = create();
    await repo.setFilter({ author: 'Homer' });
    expect(docService.getDocuments).toHaveBeenLastCalledWith(
      { author: 'Homer' },
      1,
      20,
    );
    expect(repo.getFilter()).toEqual({ author: 'Homer' });
  });

  it('should set page', async () => {
    const repo = create();
    await repo.setPage(2, 20);
    expect(docService.getDocuments).toHaveBeenLastCalledWith({}, 2, 20);
  });

  it('should reload pages when the page size changes', async () => {
    const repo = create();
    await repo.setPage(1, 20);
    await repo.setPage(1, 5);
    expect(docService.getDocuments).toHaveBeenLastCalledWith({}, 1, 5);
    let count = 0;
    repo.page$.subscribe((p) => (count = p.items.length));
    expect(count).toBe(5);
  });

  it('should reset filter on reset', async () => {
    const repo = create();
    await repo.setFilter({ title: 'x' });
    await repo.reset();
    expect(repo.getFilter()).toEqual({});
    expect(docService.getDocuments).toHaveBeenLastCalledWith({}, 1, 20);
  });

  it('should rethrow load errors and stop loading', async () => {
    const repo = create();
    docService.getDocuments.mockReturnValue(throwError(() => 'boom'));
    let loading = true;
    repo.loading$.subscribe((l) => (loading = l));
    await expect(repo.setFilter({ title: 'y' })).rejects.toBe('boom');
    expect(loading).toBe(false);
    await expect(repo.setPage(3, 20)).rejects.toBe('boom');
    await expect(repo.reset()).rejects.toBe('boom');
    expect(loading).toBe(false);
  });

  describe('active document', () => {
    it('should load the active document', () => {
      const repo = create();
      let active: Document | undefined;
      repo.activeDocument$.subscribe((d) => (active = d));
      repo.setActiveDocument(3);
      expect(docService.getDocument).toHaveBeenCalledWith(3, false);
      expect(active?.id).toBe(3);
    });

    it('should clear the active document', () => {
      const repo = create();
      let active: Document | undefined;
      repo.activeDocument$.subscribe((d) => (active = d));
      repo.setActiveDocument(3);
      repo.setActiveDocument(null);
      expect(active).toBeUndefined();
    });

    it('should log errors loading the active document', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const repo = create();
      docService.getDocument.mockReturnValue(throwError(() => 'boom'));
      let loading = true;
      repo.loading$.subscribe((l) => (loading = l));
      repo.setActiveDocument(3);
      expect(spy).toHaveBeenCalled();
      expect(loading).toBe(false);
    });
  });
});
