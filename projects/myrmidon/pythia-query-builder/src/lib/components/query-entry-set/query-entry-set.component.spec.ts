import { inputBinding, outputBinding, signal } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { QUERY_DOC_ATTR_DEFS, QUERY_TOK_ATTR_DEFS } from '../../query-builder';
import {
  QueryEntrySet,
  QueryEntrySetComponent,
} from './query-entry-set.component';

type User = ReturnType<typeof userEvent.setup>;

async function setup(isDocument = false) {
  const entrySetChange = vi.fn();
  const result = await render(QueryEntrySetComponent, {
    bindings: [
      inputBinding('isDocument', signal(isDocument)),
      inputBinding(
        'attrDefinitions',
        signal(isDocument ? QUERY_DOC_ATTR_DEFS : QUERY_TOK_ATTR_DEFS),
      ),
      outputBinding('entrySetChange', entrySetChange),
    ],
  });
  return { ...result, entrySetChange, user: userEvent.setup() };
}

async function choose(user: User, combo: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: combo }));
  await user.click(await screen.findByRole('option', { name: option }));
}

/** Fill the entry editor with a value=... pair and save it. */
async function savePair(user: User, value: string, attr = 'value') {
  // the editor sets its values in a timeout
  await new Promise((r) => setTimeout(r));
  await choose(user, 'attribute', attr);
  await choose(user, 'operator', 'equals to');
  await user.type(screen.getByRole('textbox', { name: 'value' }), value);
  await user.click(screen.getByRole('button', { name: 'Save entry' }));
}

async function saveOperator(user: User, op: string) {
  await new Promise((r) => setTimeout(r));
  await choose(user, 'type', op);
  await user.click(screen.getByRole('button', { name: 'Save entry' }));
}

const rows = () => screen.queryAllByRole('row');

/** Get the textual content of each entry row (without the numbering). */
const rowTexts = () =>
  rows().map((r) =>
    within(r)
      .getAllByRole('cell')
      .slice(1)
      .map((c) => c.textContent?.trim())
      .filter((s) => s && s !== 'error')
      .join(' '),
  );

const lastSet = (fn: ReturnType<typeof vi.fn>): QueryEntrySet =>
  fn.mock.calls[fn.mock.calls.length - 1][0];

describe('QueryEntrySetComponent', () => {
  it('should emit an empty set with errors on init', async () => {
    const { entrySetChange } = await setup();
    expect(lastSet(entrySetChange)).toEqual({
      entries: [],
      errors: ['Query is empty'],
    });
    expect(screen.getByText('Query is empty')).toBeTruthy();
  });

  it('should emit an empty set without errors for documents', async () => {
    const { entrySetChange } = await setup(true);
    expect(lastSet(entrySetChange)).toEqual({ entries: [], errors: [] });
  });

  it('should add pairs connected by AND', async () => {
    const { user, entrySetChange } = await setup();
    await user.click(screen.getByRole('button', { name: 'entry' }));
    await savePair(user, 'a');
    await user.click(screen.getByRole('button', { name: 'entry' }));
    await savePair(user, 'b');
    expect(rowTexts()).toEqual(['value equals to a', 'AND', 'value equals to b']);
    const set = lastSet(entrySetChange);
    expect(set.entries.length).toBe(3);
    expect(set.errors).toEqual([]);
  });

  it('should insert a pair before another', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'entry' }));
    await savePair(user, 'b');
    await user.click(
      within(rows()[0]).getByRole('button', {
        name: 'Add a new entry before this one',
      }),
    );
    await savePair(user, 'a');
    expect(rowTexts()).toEqual(['value equals to a', 'AND', 'value equals to b']);
  });

  it('should edit an entry', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'entry' }));
    await savePair(user, 'a');
    await user.click(screen.getByRole('button', { name: 'entry' }));
    await savePair(user, 'b');
    await user.click(
      within(rows()[1]).getByRole('button', { name: 'Edit this entry' }),
    );
    await saveOperator(user, 'OR');
    expect(rowTexts()).toEqual(['value equals to a', 'OR', 'value equals to b']);
  });

  it('should close the editor without saving', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'entry' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(rows().length).toBe(0);
  });

  it('should move and delete entries, showing errors', async () => {
    const { user, entrySetChange } = await setup();
    await user.click(screen.getByRole('button', { name: 'entry' }));
    await savePair(user, 'a');
    await user.click(screen.getByRole('button', { name: 'entry' }));
    await saveOperator(user, 'OR');
    await user.click(screen.getByRole('button', { name: 'entry' }));
    await savePair(user, 'b');

    const up = (i: number) =>
      within(rows()[i]).getByRole('button', { name: 'Move this entry up' });
    const down = (i: number) =>
      within(rows()[i]).getByRole('button', { name: 'Move this entry down' });
    expect((up(0) as HTMLButtonElement).disabled).toBe(true);
    expect((down(2) as HTMLButtonElement).disabled).toBe(true);

    await user.click(up(2));
    expect(rowTexts()).toEqual(['value equals to a', 'value equals to b', 'OR']);
    expect(lastSet(entrySetChange).errors).toContain(
      '#2: Pairs not connected by operator',
    );
    expect(
      screen.getByText('#2: Pairs not connected by operator'),
    ).toBeTruthy();

    await user.click(down(1));
    expect(rowTexts()).toEqual(['value equals to a', 'OR', 'value equals to b']);
    expect(lastSet(entrySetChange).errors).toEqual([]);

    await user.click(
      within(rows()[1]).getByRole('button', { name: 'Delete this entry' }),
    );
    expect(rowTexts()).toEqual(['value equals to a', 'value equals to b']);
  });

  it('should delete all entries', async () => {
    const { user, entrySetChange } = await setup();
    await user.click(screen.getByRole('button', { name: 'entry' }));
    await savePair(user, 'a');
    await user.click(
      screen.getByRole('button', { name: 'Delete all the entries' }),
    );
    expect(rows().length).toBe(0);
    expect(lastSet(entrySetChange).entries).toEqual([]);
  });
});
