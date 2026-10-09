import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CorpusService } from '@myrmidon/pythia-api';

import { CorpusListBrowserService } from './corpus-list-browser.service';

describe('CorpusListBrowserService', () => {
  it('should load store pages via CorpusService', async () => {
    const page = {
      items: [{ id: 'a', title: 'A', description: '' }],
      pageNumber: 2,
      pageSize: 20,
      pageCount: 2,
      total: 21,
    };
    const corpusService = { getCorpora: vi.fn().mockReturnValue(of(page)) };
    TestBed.configureTestingModule({
      providers: [{ provide: CorpusService, useValue: corpusService }],
    });
    const service = TestBed.inject(CorpusListBrowserService);

    await service.store.setFilter({ title: 'x' });
    expect(corpusService.getCorpora).toHaveBeenCalledWith({ title: 'x' }, 1, 20);

    await service.store.setPage(2);
    expect(corpusService.getCorpora).toHaveBeenLastCalledWith(
      { title: 'x' },
      2,
      20,
    );
    expect(service.store.getPage()).toEqual(page);
  });

  it('should be a singleton preserving state', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: CorpusService, useValue: {} }],
    });
    expect(TestBed.inject(CorpusListBrowserService)).toBe(
      TestBed.inject(CorpusListBrowserService),
    );
  });
});
