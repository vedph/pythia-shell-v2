import { inputBinding, outputBinding, signal } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { EnvService } from '@myrmidon/ngx-tools';
import { AttributeInfo, Lemma, WordService } from '@myrmidon/pythia-api';

import { stubTokenCountsCharts } from '../../testing/echarts-stub';
import { WordIndexComponent } from './word-index.component';

const LEMMATA: Lemma[] = [
  { type: 'lemma', id: 3, value: 'amo', reversedValue: 'oma', count: 10 },
];
const ATTRS: AttributeInfo[] = [{ name: 'genre', type: 0 }];

async function setup(hideLanguage = false) {
  const wordService = {
    getLemmata: vi.fn().mockReturnValue(
      of({ items: LEMMATA, pageNumber: 1, pageSize: 20, pageCount: 1, total: 1 }),
    ),
    getWords: vi.fn(),
    getDocAttributeInfo: vi.fn().mockReturnValue(of(ATTRS)),
    getLemmaCounts: vi.fn().mockReturnValue(of({})),
  };
  const searchRequest = vi.fn();
  const result = await render(WordIndexComponent, {
    bindings: [
      inputBinding('attributes', signal(ATTRS)),
      inputBinding('hideLanguage', signal(hideLanguage)),
      outputBinding('searchRequest', searchRequest),
    ],
    configureTestBed: stubTokenCountsCharts,
    providers: [
      { provide: WordService, useValue: wordService },
      { provide: EnvService, useValue: { get: () => 'true' } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
    ],
  });
  await result.fixture.whenStable();
  return { ...result, wordService, searchRequest, user: userEvent.setup() };
}

const amoNode = () =>
  within(
    screen
      .getByText(/amo\s*$/)
      .closest<HTMLElement>('pdb-browser-tree-node')!,
  );

describe('WordIndexComponent', () => {
  it('should pass options to the browser', async () => {
    await setup(true);
    expect(screen.queryByRole('textbox', { name: 'language' })).toBeNull();
  });

  it('should relay search requests', async () => {
    const { user, searchRequest } = await setup();
    await screen.findByText(/amo\s*$/);
    await user.click(amoNode().getByRole('button', { name: 'Search this form' }));
    expect(searchRequest).toHaveBeenCalledWith(LEMMATA[0]);
  });

  it('should show counts for the requested token', async () => {
    const { user, wordService } = await setup();
    await screen.findByText(/amo\s*$/);
    // no token yet
    expect(screen.queryByRole('combobox', { name: 'attributes' })).toBeNull();
    await user.click(
      amoNode().getByRole('button', { name: 'See this form distribution' }),
    );
    expect(screen.getByRole('combobox', { name: 'attributes' })).toBeTruthy();
    // the provided attributes are used
    expect(wordService.getDocAttributeInfo).not.toHaveBeenCalled();
  });
});
