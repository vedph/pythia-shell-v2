import { outputBinding } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { EnvService } from '@myrmidon/ngx-tools';
import { Lemma, Word, WordFilter, WordService } from '@myrmidon/pythia-api';

import { PagedWordTreeBrowserComponent } from './paged-word-tree-browser.component';

const LEMMATA: Lemma[] = [
  { type: 'lemma', id: 3, value: 'amo', reversedValue: 'oma', count: 10 },
  { type: 'lemma', id: 4, value: 'sum', reversedValue: 'mus', count: 20 },
];
const WORDS: Word[] = [
  { type: 'word', id: 7, value: 'amat', reversedValue: 'tama', count: 4, lemmaId: 3 },
];

function page<T>(items: T[]) {
  return of({ items, pageNumber: 1, pageSize: 20, pageCount: 1, total: items.length });
}

async function setup(
  options: { hasLemmata?: boolean; dialogResult?: unknown } = {},
) {
  const wordService = {
    getLemmata: vi.fn((_f: WordFilter) => page(LEMMATA)),
    getWords: vi.fn((_f: WordFilter) => page(WORDS)),
  };
  const dialog = {
    open: vi.fn().mockReturnValue({
      afterClosed: () => of(options.dialogResult),
    }),
  };
  const searchRequest = vi.fn();
  const countsRequest = vi.fn();
  const result = await render(PagedWordTreeBrowserComponent, {
    bindings: [
      outputBinding('searchRequest', searchRequest),
      outputBinding('countsRequest', countsRequest),
    ],
    providers: [
      { provide: WordService, useValue: wordService },
      {
        provide: EnvService,
        useValue: {
          get: (key: string, def?: string) =>
            key === 'hasLemmata' ? String(options.hasLemmata ?? true) : def,
        },
      },
      { provide: MatDialog, useValue: dialog },
    ],
  });
  await result.fixture.whenStable();
  return {
    ...result,
    wordService,
    dialog,
    searchRequest,
    countsRequest,
    user: userEvent.setup(),
  };
}

/** Get the tree node element displaying the specified label. */
const treeNode = (label: string): HTMLElement =>
  screen
    .getByText(new RegExp(`(^|\\s)${label}\\s*$`))
    .closest<HTMLElement>('pdb-browser-tree-node')!;

describe('PagedWordTreeBrowserComponent', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));

  it('should load and expand the root showing lemmata', async () => {
    const { wordService } = await setup();
    expect(await screen.findByText(/amo\s*$/)).toBeTruthy();
    expect(screen.getByText(/INDEX/)).toBeTruthy();
    expect(wordService.getLemmata).toHaveBeenCalled();
    expect(within(treeNode('sum')).getByText('20')).toBeTruthy();
  });

  it('should show words of an expanded lemma', async () => {
    const { user, wordService } = await setup();
    await screen.findByText(/amo\s*$/);
    // the first button in a node toggles its expansion
    await user.click(within(treeNode('amo')).getAllByRole('button')[0]);
    expect(await screen.findByText(/amat\s*$/)).toBeTruthy();
    expect(wordService.getWords).toHaveBeenCalledWith(
      expect.objectContaining({ lemmaId: 3 }),
      1,
      20,
    );
  });

  it('should list words at the first level without lemmata', async () => {
    const { wordService } = await setup({ hasLemmata: false });
    expect(await screen.findByText(/amat\s*$/)).toBeTruthy();
    expect(wordService.getLemmata).not.toHaveBeenCalled();
  });

  it('should request search and counts with positive IDs', async () => {
    const { user, searchRequest, countsRequest } = await setup();
    await screen.findByText(/amo\s*$/);
    const amo = within(treeNode('amo'));
    await user.click(amo.getByRole('button', { name: 'Search this form' }));
    expect(searchRequest).toHaveBeenCalledWith({ ...LEMMATA[0], id: 3 });
    await user.click(
      amo.getByRole('button', { name: 'See this form distribution' }),
    );
    expect(countsRequest).toHaveBeenCalledWith({ ...LEMMATA[0], id: 3 });
  });

  it('should apply the filter reloading the tree', async () => {
    const { user, wordService } = await setup();
    await screen.findByText(/amo\s*$/);
    await user.type(
      screen.getByRole('textbox', { name: 'value pattern' }),
      'am*',
    );
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(wordService.getLemmata).toHaveBeenLastCalledWith(
      expect.objectContaining({ valuePattern: 'am%', parentId: 0 }),
      1,
      20,
    );
    expect(await screen.findByText(/amo\s*$/)).toBeTruthy();
  });
});
