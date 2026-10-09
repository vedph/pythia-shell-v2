import { firstValueFrom, of } from 'rxjs';

import { EnvService } from '@myrmidon/ngx-tools';
import { Lemma, Word, WordFilter, WordService } from '@myrmidon/pythia-api';

import {
  PagedWordTreeNode,
  PagedWordTreeStoreService,
} from './paged-word-tree-store.service';

function page<T>(items: T[], pageNumber = 1, pageSize = 20) {
  return of({
    items,
    pageNumber,
    pageSize,
    pageCount: 1,
    total: items.length,
  });
}

const LEMMATA: Lemma[] = [
  { type: 'lemma', id: 3, value: 'amo', reversedValue: 'oma', count: 10 },
  { type: 'lemma', id: 4, value: 'sum', reversedValue: 'mus', count: 20 },
];
const WORDS: Word[] = [
  { type: 'word', id: 7, value: 'amat', reversedValue: 'tama', count: 4, lemmaId: 3 },
  { type: 'word', id: 8, value: 'amas', reversedValue: 'sama', count: 6, lemmaId: 3 },
];

function create(hasLemmata: boolean) {
  const wordService = {
    getLemmata: vi.fn().mockReturnValue(page(LEMMATA, 2, 2)),
    getWords: vi.fn().mockReturnValue(page(WORDS, 2, 2)),
  };
  const env = {
    get: (key: string, def?: string) =>
      key === 'hasLemmata' ? String(hasLemmata) : def,
  };
  const service = new PagedWordTreeStoreService(
    wordService as unknown as WordService,
    env as unknown as EnvService,
  );
  return { service, wordService };
}

async function nodes(
  service: PagedWordTreeStoreService,
  filter: WordFilter,
  pageNumber = 1,
  pageSize = 20,
): Promise<PagedWordTreeNode[]> {
  const p = await firstValueFrom(service.getNodes(filter, pageNumber, pageSize));
  return p.items as PagedWordTreeNode[];
}

describe('PagedWordTreeStoreService', () => {
  it('should read hasLemmata from environment', () => {
    expect(create(true).service.hasLemmata).toBe(true);
    expect(create(false).service.hasLemmata).toBe(false);
  });

  it('should return a mock root node', async () => {
    const { service, wordService } = create(true);
    const roots = await nodes(service, {});
    expect(roots.length).toBe(1);
    expect(roots[0]).toEqual(
      expect.objectContaining({ id: 0, y: 0, x: 1, label: 'INDEX', hasChildren: true }),
    );
    expect(wordService.getLemmata).not.toHaveBeenCalled();
  });

  describe('with lemmata', () => {
    it('should list lemmata under root with negative IDs', async () => {
      const { service, wordService } = create(true);
      const items = await nodes(service, { parentId: 0, valuePattern: 'a%' }, 2, 2);
      expect(wordService.getLemmata).toHaveBeenCalledWith(
        { parentId: 0, valuePattern: 'a%' },
        2,
        2,
      );
      expect(items.map((n) => [n.id, n.parentId, n.y, n.x, n.label])).toEqual([
        [-3, 0, 1, 3, 'amo'],
        [-4, 0, 1, 4, 'sum'],
      ]);
      expect(items.every((n) => n.hasChildren)).toBe(true);
      expect(items[0].token).toBe(LEMMATA[0]);
    });

    it('should list words under a lemma', async () => {
      const { service, wordService } = create(true);
      const items = await nodes(service, { parentId: -3 });
      expect(wordService.getWords).toHaveBeenCalledWith(
        expect.objectContaining({ lemmaId: 3 }),
        1,
        20,
      );
      expect(items.map((n) => [n.id, n.parentId, n.y, n.x, n.label])).toEqual([
        [7, -3, 2, 1, 'amat'],
        [8, -3, 2, 2, 'amas'],
      ]);
      expect(items.every((n) => !n.hasChildren)).toBe(true);
    });
  });

  describe('without lemmata', () => {
    it('should list words under root at the first level', async () => {
      const { service, wordService } = create(false);
      const items = await nodes(service, { parentId: 0 });
      expect(wordService.getLemmata).not.toHaveBeenCalled();
      expect(items.map((n) => [n.id, n.parentId, n.y, n.x, n.label])).toEqual([
        [7, 0, 1, 1, 'amat'],
        [8, 0, 1, 2, 'amas'],
      ]);
    });
  });
});
