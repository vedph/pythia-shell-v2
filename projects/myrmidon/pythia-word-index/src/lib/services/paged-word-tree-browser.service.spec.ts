import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { EnvService } from '@myrmidon/ngx-tools';
import { WordService } from '@myrmidon/pythia-api';

import { PagedWordTreeBrowserService } from './paged-word-tree-browser.service';

describe('PagedWordTreeBrowserService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: WordService,
          useValue: {
            getWords: vi.fn().mockReturnValue(
              of({ items: [], pageNumber: 1, pageSize: 20, pageCount: 0, total: 0 }),
            ),
          },
        },
        { provide: EnvService, useValue: { get: (_k: string, d?: string) => d } },
      ],
    });
  });

  it('should be a singleton holding a store', () => {
    const service = TestBed.inject(PagedWordTreeBrowserService);
    expect(TestBed.inject(PagedWordTreeBrowserService)).toBe(service);
    expect(service.store).toBeTruthy();
  });

  it('should load the mock root node', async () => {
    const service = TestBed.inject(PagedWordTreeBrowserService);
    await service.store.setFilter({});
    expect(service.store.getRootNode()?.label).toBe('INDEX');
  });
});
