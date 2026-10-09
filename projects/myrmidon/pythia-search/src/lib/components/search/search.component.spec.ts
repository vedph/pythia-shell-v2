import { inputBinding, signal } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  DocumentService,
  KwicSearchResult,
  ReaderService,
  SearchService,
} from '@myrmidon/pythia-api';
import {
  QUERY_BUILDER_ATTR_DEFS_KEY,
  QUERY_TOK_ATTR_DEFS,
} from '@myrmidon/pythia-query-builder';
import { CorpusRefLookupService } from '@myrmidon/pythia-ui';

import { SearchComponent } from './search.component';

function result(i: number): KwicSearchResult {
  return {
    id: `${i}`,
    documentId: 100 + i,
    p1: i,
    p2: i,
    index: i * 10,
    length: 4,
    type: 'tok',
    value: `val${i}`,
    author: `Author ${i}`,
    title: `Title ${i}`,
    sortKey: '',
    text: `text${i}`,
    leftContext: ['l5', 'l4', 'l3', 'l2', 'l1'],
    rightContext: ['r1', 'r2', 'r3', 'r4', 'r5'],
  };
}

function page(pageNumber: number, pageSize: number, total = 25) {
  const items: KwicSearchResult[] = [];
  for (
    let i = (pageNumber - 1) * pageSize;
    i < Math.min(total, pageNumber * pageSize);
    i++
  ) {
    items.push(result(i));
  }
  return {
    value: {
      items,
      pageNumber,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
      total,
    },
  };
}

async function setup(
  options: {
    initialQueryTerm?: string;
    hideAuthor?: boolean;
    hideTitle?: boolean;
  } = {},
) {
  const searchService = {
    search: vi.fn((_q: string, _c: number, n: number, s: number) =>
      of(page(n, s)),
    ),
    exportSearchResults: vi.fn().mockReturnValue(of('')),
  };
  const readerService = {
    getDocumentMap: vi.fn().mockReturnValue(
      of({ label: 'root', location: '/', start: 0, end: 10 }),
    ),
    getDocumentPieceFromRange: vi.fn().mockReturnValue(of({ text: 'piece' })),
    getDocumentPieceFromPath: vi.fn().mockReturnValue(of({ text: 'path' })),
    getNodePath: () => '0',
  };
  const docService = {
    getDocument: vi.fn((id: number) =>
      of({ id, author: 'A', title: `Doc ${id}`, attributes: [] }),
    ),
  };
  const result = await render(SearchComponent, {
    bindings: [
      inputBinding('initialQueryTerm', signal(options.initialQueryTerm)),
      inputBinding('hideAuthor', signal(options.hideAuthor)),
      inputBinding('hideTitle', signal(options.hideTitle)),
    ],
    providers: [
      { provide: SearchService, useValue: searchService },
      { provide: ReaderService, useValue: readerService },
      { provide: DocumentService, useValue: docService },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: QUERY_BUILDER_ATTR_DEFS_KEY, useValue: QUERY_TOK_ATTR_DEFS },
      {
        provide: CorpusRefLookupService,
        useValue: { id: 'corpus', lookup: () => of([]), getName: () => '' },
      },
    ],
  });
  await result.fixture.whenStable();
  return {
    ...result,
    searchService,
    readerService,
    user: userEvent.setup(),
  };
}

const queryBox = () =>
  screen.getByRole('textbox', { name: 'query' }) as HTMLTextAreaElement;
const searchButton = () =>
  screen.getByRole('button', { name: /search/ }) as HTMLButtonElement;
const bodyRows = () =>
  within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

describe('SearchComponent', () => {
  it('should disable search without query', async () => {
    await setup();
    expect(searchButton().disabled).toBe(true);
  });

  it('should search and show KWIC results', async () => {
    const { user, searchService } = await setup();
    // [ is escaped as [[ in user-event key descriptors
    await user.type(queryBox(), '[[value="a"]');
    await user.click(searchButton());
    expect(searchService.search).toHaveBeenCalledWith('[value="a"]', 5, 1, 20);
    expect(bodyRows().length).toBe(20);
    const row = bodyRows()[1];
    expect(within(row).getByText('Author 1')).toBeTruthy();
    expect(within(row).getByText('Title 1')).toBeTruthy();
    expect(within(row).getByText('l5')).toBeTruthy();
    expect(within(row).getByText('text1')).toBeTruthy();
    expect(within(row).getByText('r5')).toBeTruthy();
    expect(screen.getByText('25')).toBeTruthy();
    // export appears with a query
    expect(screen.getByRole('button', { name: /export/ })).toBeTruthy();
  });

  it('should render no <form> element', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('should search with ctrl+Enter', async () => {
    const { user, searchService } = await setup();
    await user.type(queryBox(), 'q');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(searchService.search).toHaveBeenCalledWith('q', 5, 1, 20);
  });

  it('should hide author and title columns', async () => {
    const { user } = await setup({ hideAuthor: true, hideTitle: true });
    await user.type(queryBox(), 'q');
    await user.click(searchButton());
    expect(screen.queryByRole('columnheader', { name: 'author' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'title' })).toBeNull();
    expect(screen.queryByText('Author 1')).toBeNull();
  });

  it('should show no results', async () => {
    const { user, searchService } = await setup();
    searchService.search.mockReturnValue(of(page(1, 20, 0)));
    await user.type(queryBox(), 'q');
    await user.click(searchButton());
    expect(screen.getByText('(no results)')).toBeTruthy();
  });

  it('should show query errors', async () => {
    const { user, searchService } = await setup();
    searchService.search.mockReturnValue(
      of({ error: 'Syntax error at 1' }) as unknown as ReturnType<typeof of>,
    );
    await user.type(queryBox(), 'bad');
    await user.click(searchButton());
    expect(screen.getByText('Syntax error at 1')).toBeTruthy();
  });

  it('should show a query too long error', async () => {
    const { fixture, user } = await setup();
    fixture.componentInstance.form.query().value.set('x'.repeat(1001));
    await user.click(queryBox());
    await user.tab();
    expect(screen.getByText('query too long')).toBeTruthy();
  });

  it('should page results', async () => {
    const { user, searchService } = await setup();
    await user.type(queryBox(), 'q');
    await user.click(searchButton());
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(searchService.search).toHaveBeenLastCalledWith('q', 5, 2, 20);
    expect(bodyRows().length).toBe(5);
  });

  it('should read a result in context, also at index 0', async () => {
    const { user, readerService } = await setup();
    await user.type(queryBox(), 'q');
    await user.click(searchButton());
    await user.click(
      within(bodyRows()[0]).getByRole('button', { name: 'Read in context' }),
    );
    expect(readerService.getDocumentPieceFromRange).toHaveBeenCalledWith(
      100,
      0,
      4,
    );
    expect(await screen.findByText('piece')).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'A - Doc 100' }),
    ).toBeTruthy();
  });

  it('should read a whole document', async () => {
    const { user, readerService } = await setup();
    await user.type(queryBox(), 'q');
    await user.click(searchButton());
    await user.click(
      within(bodyRows()[2]).getByRole('button', { name: 'Read document' }),
    );
    expect(readerService.getDocumentMap).toHaveBeenCalledWith(102);
    expect(readerService.getDocumentPieceFromRange).not.toHaveBeenCalled();
  });

  it('should keep queries history and pick from it', async () => {
    const { user } = await setup();
    await user.type(queryBox(), 'q1');
    await user.click(searchButton());
    await user.clear(queryBox());
    await user.type(queryBox(), 'q2');
    await user.click(searchButton());
    await user.click(screen.getByRole('combobox', { name: 'history' }));
    await user.click(await screen.findByRole('option', { name: 'q1' }));
    await user.click(
      screen.getByRole('button', { name: 'Pick the selected query' }),
    );
    expect(queryBox().value).toBe('q1');
  });

  it('should search an initial value term', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const { searchService } = await setup({ initialQueryTerm: 'amor' });
      await vi.runAllTimersAsync();
      expect(queryBox().value).toBe('[value="amor"]');
      expect(searchService.search).toHaveBeenCalledWith(
        '[value="amor"]',
        5,
        1,
        20,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('should search an initial lemma term', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await setup({ initialQueryTerm: '^amor' });
      await vi.runAllTimersAsync();
      expect(queryBox().value).toBe('[lemma="amor"]');
    } finally {
      vi.useRealTimers();
    }
  });

  it('should search from the query builder', async () => {
    const { fixture, searchService } = await setup();
    fixture.componentInstance.onQueryChange('[value="b"]');
    await fixture.whenStable();
    expect(queryBox().value).toBe('[value="b"]');
    expect(searchService.search).toHaveBeenCalledWith('[value="b"]', 5, 1, 20);
  });
});
