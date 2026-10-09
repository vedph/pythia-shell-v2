import { inputBinding, outputBinding, signal } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import {
  QueryBuilderEntry,
  QueryBuilderTermDef,
  QUERY_DOC_ATTR_DEFS,
  QUERY_LOCATION_OP_DEFS,
  QUERY_OP_DEFS,
  QUERY_PAIR_OP_DEFS,
  QUERY_TOK_ATTR_DEFS,
} from '../../query-builder';
import { QueryEntryComponent } from './query-entry.component';

const VALUE_ATTR = QUERY_TOK_ATTR_DEFS.find((d) => d.value === 'value')!;
const EQ_OP = QUERY_PAIR_OP_DEFS.find((d) => d.value === '=')!;
const FUZZY_OP = QUERY_PAIR_OP_DEFS.find((d) => d.value === '%=')!;
const NEAR_OP = QUERY_LOCATION_OP_DEFS.find((d) => d.value === 'NEAR')!;

async function setup(
  options: {
    entry?: QueryBuilderEntry | null;
    isDocument?: boolean;
    attrDefinitions?: QueryBuilderTermDef[];
  } = {},
) {
  const entry = signal<QueryBuilderEntry | null | undefined>(options.entry);
  const entryChange = vi.fn();
  const editorClose = vi.fn();
  const result = await render(QueryEntryComponent, {
    bindings: [
      inputBinding('entry', entry),
      inputBinding('isDocument', signal(options.isDocument)),
      inputBinding(
        'attrDefinitions',
        signal(options.attrDefinitions ?? QUERY_TOK_ATTR_DEFS),
      ),
      outputBinding('entryChange', entryChange),
      outputBinding('editorClose', editorClose),
    ],
  });
  // entry values are set in a timeout
  await new Promise((r) => setTimeout(r));
  await result.fixture.whenStable();
  return { ...result, entry, entryChange, editorClose, user: userEvent.setup() };
}

type User = ReturnType<typeof userEvent.setup>;

async function choose(user: User, combo: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: combo }));
  await user.click(await screen.findByRole('option', { name: option }));
}

const saveButton = () => screen.getByRole('button', { name: 'Save entry' });

describe('QueryEntryComponent', () => {
  it('should default to a pair', async () => {
    await setup();
    expect(
      within(screen.getByRole('combobox', { name: 'type' })).getByText('pair'),
    ).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'attribute' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'operator' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'value' })).toBeTruthy();
  });

  it('should offer location operators only for text', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('combobox', { name: 'type' }));
    expect(await screen.findByRole('option', { name: 'near to' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'AND NOT' })).toBeNull();
  });

  it('should offer AND NOT and no location operators for documents', async () => {
    const { user } = await setup({
      isDocument: true,
      attrDefinitions: QUERY_DOC_ATTR_DEFS,
    });
    await user.click(screen.getByRole('combobox', { name: 'type' }));
    expect(await screen.findByRole('option', { name: 'AND NOT' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'near to' })).toBeNull();
  });

  it('should group attributes', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('combobox', { name: 'attribute' }));
    expect(await screen.findByRole('group', { name: 'token' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'span' })).toBeTruthy();
  });

  it('should save a pair', async () => {
    const { user, entryChange } = await setup();
    await choose(user, 'attribute', 'value');
    await choose(user, 'operator', 'equals to');
    await user.type(screen.getByRole('textbox', { name: 'value' }), 'amor');
    await user.click(saveButton());
    expect(entryChange).toHaveBeenCalledWith({
      pair: {
        attribute: VALUE_ATTR,
        operator: EQ_OP,
        opArgs: [],
        value: 'amor',
      },
    });
  });

  it('should not save an incomplete pair', async () => {
    const { user, entryChange } = await setup();
    await choose(user, 'attribute', 'value');
    await user.click(saveButton());
    expect(entryChange).not.toHaveBeenCalled();
  });

  it('should show value errors', async () => {
    const { user } = await setup();
    const value = screen.getByRole('textbox', { name: 'value' });
    await user.type(value, 'x'.repeat(101));
    await user.tab();
    expect(screen.getByText('value too long')).toBeTruthy();
    await user.clear(value);
    await user.tab();
    expect(screen.getByText('value required')).toBeTruthy();
  });

  it('should save a pair with operator args', async () => {
    const { user, entryChange } = await setup();
    await choose(user, 'attribute', 'value');
    await choose(user, 'operator', 'is similar to');
    await user.type(screen.getByRole('spinbutton', { name: 'treshold' }), '0.5');
    await user.click(screen.getByRole('button', { name: 'Save arguments' }));
    await user.type(screen.getByRole('textbox', { name: 'value' }), 'amor');
    await user.click(saveButton());
    expect(entryChange).toHaveBeenCalledWith({
      pair: {
        attribute: VALUE_ATTR,
        operator: FUZZY_OP,
        opArgs: [{ ...FUZZY_OP.args![0], value: '0.5' }],
        value: 'amor',
      },
    });
  });

  it('should save a logical operator', async () => {
    const { user, entryChange } = await setup();
    await choose(user, 'type', 'OR');
    expect(screen.queryByRole('combobox', { name: 'attribute' })).toBeNull();
    await user.click(saveButton());
    expect(entryChange).toHaveBeenCalledWith({
      operator: QUERY_OP_DEFS.find((d) => d.value === 'OR'),
      opArgs: [],
    });
  });

  it('should save a location operator with args', async () => {
    const { user, entryChange } = await setup();
    await choose(user, 'type', 'near to');
    expect(screen.getByText(NEAR_OP.tip!)).toBeTruthy();
    await user.type(screen.getByRole('spinbutton', { name: 'max distance' }), '3');
    await user.click(screen.getByRole('button', { name: 'Save arguments' }));
    await user.click(saveButton());
    expect(entryChange).toHaveBeenCalledWith({
      operator: NEAR_OP,
      opArgs: [{ ...NEAR_OP.args![1], value: '3' }],
    });
  });

  it('should load a pair entry', async () => {
    await setup({
      entry: {
        pair: { attribute: VALUE_ATTR, operator: EQ_OP, value: 'amor' },
      },
    });
    expect(
      (screen.getByRole('textbox', { name: 'value' }) as HTMLInputElement).value,
    ).toBe('amor');
    expect(
      within(screen.getByRole('combobox', { name: 'operator' })).getByText(
        'equals to',
      ),
    ).toBeTruthy();
  });

  it('should load a fuzzy pair entry with its args', async () => {
    await setup({
      entry: {
        pair: {
          attribute: VALUE_ATTR,
          operator: FUZZY_OP,
          value: 'amor',
          opArgs: [{ ...FUZZY_OP.args![0], value: '0.6' }],
        },
      },
    });
    expect(
      (screen.getByRole('spinbutton', { name: 'treshold' }) as HTMLInputElement)
        .value,
    ).toBe('0.6');
  });

  it('should load a location operator entry with its args', async () => {
    await setup({
      entry: {
        operator: NEAR_OP,
        opArgs: [{ ...NEAR_OP.args![0], value: '1' }],
      },
    });
    expect(
      within(screen.getByRole('combobox', { name: 'type' })).getByText(
        'near to',
      ),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole('spinbutton', {
          name: 'min.distance',
        }) as HTMLInputElement
      ).value,
    ).toBe('1');
  });

  it('should emit close', async () => {
    const { user, editorClose } = await setup();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(editorClose).toHaveBeenCalled();
  });
});
