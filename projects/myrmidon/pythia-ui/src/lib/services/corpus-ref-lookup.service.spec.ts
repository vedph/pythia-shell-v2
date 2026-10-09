import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CorpusService } from '@myrmidon/pythia-api';
import { Corpus } from '@myrmidon/pythia-core';

import { CorpusRefLookupService } from './corpus-ref-lookup.service';

describe('CorpusRefLookupService', () => {
  let service: CorpusRefLookupService;
  let corpusService: {
    getCorpus: ReturnType<typeof vi.fn>;
    getCorpora: ReturnType<typeof vi.fn>;
  };

  const corpora: Corpus[] = [
    { id: 'a', title: 'Alpha', description: '' },
    { id: 'b', title: 'Beta', description: '' },
  ];

  beforeEach(() => {
    corpusService = {
      getCorpus: vi.fn().mockReturnValue(of(corpora[0])),
      getCorpora: vi.fn().mockReturnValue(
        of({ items: corpora, pageNumber: 1, pageSize: 5, pageCount: 1, total: 2 }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: CorpusService, useValue: corpusService }],
    });
    service = TestBed.inject(CorpusRefLookupService);
  });

  it('should have corpus ID', () => {
    expect(service.id).toBe('corpus');
  });

  it('should get by ID without document IDs', () => {
    let result: unknown;
    service.getById('a').subscribe((c) => (result = c));
    expect(corpusService.getCorpus).toHaveBeenCalledWith('a', true);
    expect(result).toEqual(corpora[0]);
  });

  it('should look up by title, returning the page items', () => {
    let result: Corpus[] = [];
    service.lookup({ text: 'al', limit: 5 }).subscribe((r) => (result = r));
    expect(corpusService.getCorpora).toHaveBeenCalledWith({ title: 'al' }, 1, 5);
    expect(result).toEqual(corpora);
  });

  it('should get the title as name', () => {
    expect(service.getName(corpora[1])).toBe('Beta');
  });
});
