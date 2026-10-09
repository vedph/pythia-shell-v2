import { inputBinding, signal } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, Subject, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import {
  AttributeInfo,
  Lemma,
  TokenCount,
  Word,
  WordService,
} from '@myrmidon/pythia-api';

import { stubTokenCountsCharts } from '../../testing/echarts-stub';
import { TokenCountsListComponent } from './token-counts-list.component';

type User = ReturnType<typeof userEvent.setup>;

const ATTRS: AttributeInfo[] = [
  { name: 'genre', type: 0 },
  { name: 'year', type: 1 },
];

const word = (id: number, value: string, extra: Partial<Word> = {}): Word => ({
  type: 'word',
  id,
  value,
  reversedValue: value,
  count: 5,
  ...extra,
});
const LEMMA: Lemma = {
  type: 'lemma',
  id: 3,
  value: 'amo',
  reversedValue: 'oma',
  count: 10,
  language: 'lat',
};

function counts(attr: string, value: number): { [key: string]: TokenCount[] } {
  return {
    [attr]: [
      { sourceId: 1, attributeName: attr, attributeValue: 'x', value },
    ],
  };
}

async function setup(
  options: { token?: Word | Lemma; attributes?: AttributeInfo[] } = {},
) {
  const token = signal<Word | Lemma | undefined>(options.token);
  const wordService = {
    getDocAttributeInfo: vi.fn().mockReturnValue(of(ATTRS)),
    getWordCounts: vi.fn((id: number) => of(counts('genre', id))),
    getLemmaCounts: vi.fn((id: number) => of(counts('genre', 100 + id))),
  };
  const bindings = [inputBinding('token', token)];
  if (options.attributes) {
    bindings.push(inputBinding('attributes', signal(options.attributes)));
  }
  const result = await render(TokenCountsListComponent, {
    bindings,
    configureTestBed: stubTokenCountsCharts,
    providers: [
      { provide: WordService, useValue: wordService },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
    ],
  });
  await result.fixture.whenStable();
  return { ...result, token, wordService, user: userEvent.setup() };
}

async function selectAttributes(user: User, ...names: string[]) {
  await user.click(screen.getByRole('combobox', { name: 'attributes' }));
  for (const n of names) {
    await user.click(await screen.findByRole('option', { name: new RegExp(`^${n}`) }));
  }
  await user.keyboard('{Escape}');
  await user.click(
    screen.getByRole('button', { name: 'Set selected attributes' }),
  );
}

/** Get the total shown by the counts of the specified attribute. */
const totalOf = (attr: string) =>
  within(
    screen.getByRole('heading', { name: attr }).parentElement!,
  ).getByRole('button', { expanded: false }).textContent?.trim();

describe('TokenCountsListComponent', () => {
  it('should render nothing without token', async () => {
    await setup();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('should load the attributes when not provided', async () => {
    const { user, wordService } = await setup({ token: word(1, 'amat') });
    expect(wordService.getDocAttributeInfo).toHaveBeenCalled();
    await user.click(screen.getByRole('combobox', { name: 'attributes' }));
    expect(await screen.findByRole('option', { name: 'genre' })).toBeTruthy();
    // numeric attributes are marked
    expect(screen.getByRole('option', { name: 'yearⁿ' })).toBeTruthy();
  });

  it('should use the provided attributes', async () => {
    const { wordService } = await setup({
      token: word(1, 'amat'),
      attributes: ATTRS,
    });
    expect(wordService.getDocAttributeInfo).not.toHaveBeenCalled();
  });

  it('should show the token', async () => {
    await setup({ token: LEMMA });
    expect(screen.getByText('lat')).toBeTruthy();
    expect(screen.getByText('amo')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
  });

  it('should load word counts for the selected attributes', async () => {
    const { user, wordService } = await setup({ token: word(7, 'amat') });
    await selectAttributes(user, 'genre');
    expect(wordService.getWordCounts).toHaveBeenCalledWith(7, ['genre']);
    expect(totalOf('genre')).toBe('7');
  });

  it('should load lemma counts', async () => {
    const { user, wordService } = await setup({ token: LEMMA });
    await selectAttributes(user, 'genre');
    expect(wordService.getLemmaCounts).toHaveBeenCalledWith(3, ['genre']);
    expect(totalOf('genre')).toBe('103');
  });

  it('should reload counts for another word without lemma', async () => {
    const { user, token, fixture, wordService } = await setup({
      token: word(7, 'amat'),
    });
    await selectAttributes(user, 'genre');
    token.set(word(8, 'amas'));
    await fixture.whenStable();
    expect(wordService.getWordCounts).toHaveBeenLastCalledWith(8, ['genre']);
    expect(totalOf('genre')).toBe('8');
  });

  it('should not reload counts for an equal token', async () => {
    const { user, token, fixture, wordService } = await setup({
      token: word(7, 'amat'),
    });
    await selectAttributes(user, 'genre');
    token.set(word(7, 'amat'));
    await fixture.whenStable();
    expect(wordService.getWordCounts).toHaveBeenCalledTimes(1);
  });

  it('should replace a pending load when the token changes', async () => {
    const { user, token, fixture, wordService } = await setup({
      token: word(7, 'amat'),
    });
    await selectAttributes(user, 'genre');
    const pending = new Subject<{ [key: string]: TokenCount[] }>();
    wordService.getWordCounts.mockReturnValueOnce(pending);
    token.set(word(8, 'amas'));
    await fixture.whenStable();
    token.set(word(9, 'amant'));
    await fixture.whenStable();
    expect(pending.observed).toBe(false);
    expect(totalOf('genre')).toBe('9');
  });

  it('should clear counts when no attribute is selected', async () => {
    const { user, token, fixture } = await setup({ token: word(7, 'amat') });
    await selectAttributes(user, 'genre');
    await selectAttributes(user, 'genre'); // deselect
    token.set(word(8, 'amas'));
    await fixture.whenStable();
    expect(screen.queryByRole('heading', { name: 'genre' })).toBeNull();
  });

  it('should stop loading on error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user, wordService } = await setup({ token: word(7, 'amat') });
    wordService.getWordCounts.mockReturnValueOnce(throwError(() => 'boom'));
    await selectAttributes(user, 'genre');
    expect(screen.queryByRole('progressbar')).toBeNull();
    const button = screen.getByRole('button', {
      name: 'Set selected attributes',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    await user.click(button);
    expect(totalOf('genre')).toBe('7');
  });
});
