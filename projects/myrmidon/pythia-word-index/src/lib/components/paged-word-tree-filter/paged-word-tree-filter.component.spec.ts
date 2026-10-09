import { inputBinding, outputBinding, signal } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { WordFilter, WordSortOrder } from '@myrmidon/pythia-api';

import {
  PagedWordTreeFilterComponent,
  WordTreeFilterSortOrderEntry,
} from './paged-word-tree-filter.component';

type User = ReturnType<typeof userEvent.setup>;

async function setup(
  options: {
    filter?: WordFilter | null;
    hideLanguage?: boolean;
    hidePos?: boolean;
    sortOrderEntries?: WordTreeFilterSortOrderEntry[];
  } = {},
) {
  const filter = signal<WordFilter | null | undefined>(options.filter);
  const filterChange = vi.fn();
  const bindings = [
    inputBinding('filter', filter),
    inputBinding('hideLanguage', signal(options.hideLanguage)),
    inputBinding('hidePos', signal(options.hidePos)),
    outputBinding('filterChange', filterChange),
  ];
  if (options.sortOrderEntries) {
    bindings.push(
      inputBinding('sortOrderEntries', signal(options.sortOrderEntries)),
    );
  }
  const result = await render(PagedWordTreeFilterComponent, { bindings });
  await result.fixture.whenStable();
  return { ...result, filter, filterChange, user: userEvent.setup() };
}

const box = (name: string) =>
  screen.getByRole('textbox', { name }) as HTMLInputElement;
const num = (name: string) =>
  screen.getByRole('spinbutton', { name }) as HTMLInputElement;
const apply = () => screen.getByRole('button', { name: 'Apply filters' });
const last = (fn: ReturnType<typeof vi.fn>): WordFilter =>
  fn.mock.calls[fn.mock.calls.length - 1][0];

async function choose(user: User, combo: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: combo }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('PagedWordTreeFilterComponent', () => {
  it('should hide language and POS when requested', async () => {
    await setup({ hideLanguage: true, hidePos: true });
    expect(screen.queryByRole('textbox', { name: 'language' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'POS' })).toBeNull();
  });

  it('should emit a default filter', async () => {
    const { user, filterChange } = await setup();
    await user.click(apply());
    expect(filterChange).toHaveBeenCalledWith({
      language: undefined,
      pos: undefined,
      valuePattern: undefined,
      minValueLength: undefined,
      maxValueLength: undefined,
      minCount: undefined,
      maxCount: undefined,
      sortOrder: WordSortOrder.Default,
      isSortDescending: undefined,
    });
  });

  it('should emit all filter values', async () => {
    const { user, filterChange } = await setup();
    await user.type(box('language'), 'lat');
    await choose(user, 'POS', 'verb');
    await user.type(box('value pattern'), 'am*');
    await user.clear(num('min.len.'));
    await user.type(num('min.len.'), '2');
    await user.clear(num('max.len.'));
    await user.type(num('max.len.'), '9');
    await user.clear(num('min.freq.'));
    await user.type(num('min.freq.'), '3');
    await user.clear(num('max.freq.'));
    await user.type(num('max.freq.'), '99');
    await choose(user, 'sort order', '▼ frequency');
    await user.click(apply());
    expect(filterChange).toHaveBeenCalledWith({
      language: 'lat',
      pos: 'VERB',
      valuePattern: 'am%',
      minValueLength: 2,
      maxValueLength: 9,
      minCount: 3,
      maxCount: 99,
      sortOrder: WordSortOrder.ByCount,
      isSortDescending: true,
    });
  });

  it('should convert all the wildcards to SQL', async () => {
    const { user, filterChange } = await setup();
    await user.type(box('value pattern'), '*a?b*c?');
    await user.click(apply());
    expect(last(filterChange).valuePattern).toBe('%a_b%c_');
  });

  it('should load the filter showing UI wildcards', async () => {
    await setup({
      filter: {
        language: 'ita',
        valuePattern: '%a_b%',
        minCount: 2,
        sortOrder: WordSortOrder.ByReversedValue,
        isSortDescending: true,
      },
    });
    expect(box('language').value).toBe('ita');
    expect(box('value pattern').value).toBe('*a?b*');
    expect(num('min.freq.').value).toBe('2');
    expect(
      within(screen.getByRole('combobox', { name: 'sort order' })).getByText(
        '▼ reversed value',
      ),
    ).toBeTruthy();
  });

  it('should match ascending sort when descending is false', async () => {
    await setup({
      filter: { sortOrder: WordSortOrder.ByValue, isSortDescending: false },
    });
    expect(
      within(screen.getByRole('combobox', { name: 'sort order' })).getByText(
        '▲ value',
      ),
    ).toBeTruthy();
  });

  it('should round-trip an applied filter', async () => {
    const { user, filter, filterChange, fixture } = await setup();
    await user.type(box('value pattern'), 'a*');
    await user.click(apply());
    filter.set(last(filterChange));
    await fixture.whenStable();
    expect(box('value pattern').value).toBe('a*');
  });

  it('should use custom sort entries', async () => {
    const { user } = await setup({
      sortOrderEntries: [{ key: 'by count', value: WordSortOrder.ByCount }],
    });
    await user.click(screen.getByRole('combobox', { name: 'sort order' }));
    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent?.trim())).toEqual(['by count']);
  });

  it('should apply the filter on Enter', async () => {
    const { user, filterChange } = await setup();
    await user.type(box('language'), 'lat{Enter}');
    expect(last(filterChange).language).toBe('lat');
  });

  it('should refuse a negative count, also on Enter', async () => {
    const { user, filterChange, fixture } = await setup();
    await user.clear(num('min.freq.'));
    await user.type(num('min.freq.'), '-1');
    await fixture.whenStable();
    expect(fixture.componentInstance.form.minCount().value()).toBe(-1);
    expect((apply() as HTMLButtonElement).disabled).toBe(true);
    await user.type(num('min.freq.'), '{Enter}');
    expect(filterChange).not.toHaveBeenCalled();
  });

  it('should pick the first sort entry when the entries drop the current one', async () => {
    const entries = signal<WordTreeFilterSortOrderEntry[]>([
      { key: 'by value', value: WordSortOrder.ByValue },
      { key: 'by count', value: WordSortOrder.ByCount },
    ]);
    const filterChange = vi.fn();
    const { fixture } = await render(PagedWordTreeFilterComponent, {
      bindings: [
        inputBinding('sortOrderEntries', entries),
        outputBinding('filterChange', filterChange),
      ],
    });
    const user = userEvent.setup();
    await choose(user, 'sort order', 'by count');
    entries.set([{ key: 'by reversed', value: WordSortOrder.ByReversedValue }]);
    await fixture.whenStable();
    await user.click(apply());
    expect(last(filterChange).sortOrder).toBe(WordSortOrder.ByReversedValue);
  });

  it('should render no <form> element', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('should reset the filter', async () => {
    const { user, filterChange } = await setup({ filter: { language: 'x' } });
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(box('language').value).toBe('');
    expect(filterChange).toHaveBeenLastCalledWith({});
  });

  describe('as dialog', () => {
    async function setupDialog(filter?: WordFilter) {
      const dialogRef = { close: vi.fn() };
      await render(PagedWordTreeFilterComponent, {
        providers: [
          { provide: MatDialogRef, useValue: dialogRef },
          { provide: MAT_DIALOG_DATA, useValue: { filter } },
        ],
      });
      return { dialogRef, user: userEvent.setup() };
    }

    it('should load the dialog filter and close with the new one', async () => {
      const { dialogRef, user } = await setupDialog({ language: 'lat' });
      expect(box('language').value).toBe('lat');
      await user.click(apply());
      expect(dialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'lat' }),
      );
    });

    it('should close with null on reset', async () => {
      const { dialogRef, user } = await setupDialog();
      await user.click(screen.getByRole('button', { name: 'Reset filters' }));
      expect(dialogRef.close).toHaveBeenCalledWith(null);
    });
  });
});
