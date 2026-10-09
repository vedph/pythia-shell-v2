import { inputBinding, outputBinding, signal } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { Corpus } from '@myrmidon/pythia-core';
import { CorpusRefLookupService } from '@myrmidon/pythia-ui';

import {
  QUERY_DOC_ATTR_DEFS,
  QUERY_STRUCT_ATTR_DEFS,
  QUERY_TOK_ATTR_DEFS,
} from '../../query-builder';
import {
  QUERY_BUILDER_ATTR_DEFS_KEY,
  QueryBuilderComponent,
} from './query-builder.component';

type User = ReturnType<typeof userEvent.setup>;

const CORPUS: Corpus = { id: 'c1', title: 'Alpha', description: '' };

async function setup(
  options: { hideCorpora?: boolean; hideDocuments?: boolean } = {},
) {
  const queryChange = vi.fn();
  const queryPeek = vi.fn();
  const result = await render(QueryBuilderComponent, {
    bindings: [
      inputBinding('hideCorpora', signal(options.hideCorpora)),
      inputBinding('hideDocuments', signal(options.hideDocuments)),
      outputBinding('queryChange', queryChange),
      outputBinding('queryPeek', queryPeek),
    ],
    providers: [
      {
        provide: QUERY_BUILDER_ATTR_DEFS_KEY,
        useValue: [
          ...QUERY_DOC_ATTR_DEFS,
          ...QUERY_TOK_ATTR_DEFS,
          ...QUERY_STRUCT_ATTR_DEFS,
        ],
      },
      {
        provide: CorpusRefLookupService,
        useValue: {
          id: 'corpus',
          lookup: () => of([CORPUS]),
          getName: (c?: Corpus) => c?.title ?? '',
        },
      },
    ],
  });
  return { ...result, queryChange, queryPeek, user: userEvent.setup() };
}

async function choose(
  user: User,
  combo: string,
  option: string,
  group?: string,
) {
  await user.click(screen.getByRole('combobox', { name: combo }));
  const scope = group
    ? within(await screen.findByRole('group', { name: group }))
    : screen;
  await user.click(await scope.findByRole('option', { name: option }));
}

/**
 * Add a pair to the entries set in the specified container.
 */
async function addPair(
  user: User,
  container: HTMLElement,
  attr: string,
  value: string,
  group = 'token',
) {
  await user.click(within(container).getByRole('button', { name: 'entry' }));
  await new Promise((r) => setTimeout(r));
  await choose(user, 'attribute', attr, group);
  await choose(user, 'operator', 'equals to');
  await user.type(within(container).getByRole('textbox', { name: 'value' }), value);
  await user.click(within(container).getByRole('button', { name: 'Save entry' }));
}

/** The text entries set, which is the last one in the component. */
const textSet = () => {
  const sets = document.querySelectorAll<HTMLElement>('pythia-query-entry-set');
  return sets[sets.length - 1];
};

const buildButton = () =>
  screen.getByRole('button', { name: /build/ }) as HTMLButtonElement;
const peekButton = () =>
  screen.getByRole('button', { name: /to text/ }) as HTMLButtonElement;

describe('QueryBuilderComponent', () => {
  it('should show scope sections by default', async () => {
    await setup();
    expect(screen.getByRole('group', { name: 'scope' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /corpora/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /documents/ })).toBeTruthy();
  });

  it('should hide scope sections when requested', async () => {
    await setup({ hideCorpora: true, hideDocuments: true });
    expect(screen.queryByRole('group', { name: 'scope' })).toBeNull();
  });

  it('should hide only corpora', async () => {
    await setup({ hideCorpora: true });
    expect(screen.queryByRole('button', { name: /corpora/ })).toBeNull();
    expect(screen.getByRole('button', { name: /documents/ })).toBeTruthy();
  });

  it('should disable build while the query is empty', async () => {
    await setup();
    expect(buildButton().disabled).toBe(true);
    expect(peekButton().disabled).toBe(true);
  });

  it('should offer only non-document attributes for text', async () => {
    const { user } = await setup();
    await user.click(within(textSet()).getByRole('button', { name: 'entry' }));
    await user.click(screen.getByRole('combobox', { name: 'attribute' }));
    expect(await screen.findByRole('group', { name: 'token' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'structure' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'document' })).toBeNull();
  });

  it('should build and peek a text query', async () => {
    const { user, queryChange, queryPeek } = await setup();
    await addPair(user, textSet(), 'value', 'amor');
    expect(buildButton().disabled).toBe(false);
    await user.click(buildButton());
    expect(queryChange).toHaveBeenCalledWith('[value="amor"]');
    await user.click(peekButton());
    expect(queryPeek).toHaveBeenCalledWith('[value="amor"]');
  });

  it('should build a query with documents scope', async () => {
    const { user, queryChange } = await setup();
    await user.click(screen.getByRole('button', { name: /documents/ }));
    const docSet = document.querySelector<HTMLElement>(
      '#doc-panel pythia-query-entry-set',
    )!;
    await addPair(user, docSet, 'author', 'Catullus', 'document');
    await addPair(user, textSet(), 'value', 'amor');
    await user.click(buildButton());
    expect(queryChange).toHaveBeenCalledWith(
      '@[author="Catullus"];\n[value="amor"]',
    );
  });

  it('should build a query with corpora scope', async () => {
    const { user, queryChange } = await setup();
    await user.click(screen.getByRole('button', { name: /corpora/ }));
    await user.click(screen.getByRole('button', { name: 'corpus' }));
    await user.type(screen.getByPlaceholderText('corpus'), 'a');
    await user.click(await screen.findByRole('option', { name: 'Alpha' }));
    await addPair(user, textSet(), 'value', 'amor');
    await user.click(buildButton());
    expect(queryChange).toHaveBeenCalledWith('@@c1;\n[value="amor"]');
  });

  it('should not build with errors', async () => {
    const { user, queryChange } = await setup();
    await addPair(user, textSet(), 'value', 'amor');
    // add a dangling OR
    await user.click(within(textSet()).getByRole('button', { name: 'entry' }));
    await new Promise((r) => setTimeout(r));
    await choose(user, 'type', 'OR');
    await user.click(screen.getByRole('button', { name: 'Save entry' }));
    expect(buildButton().disabled).toBe(true);
    expect(screen.getByText('#2: Logical operator at end')).toBeTruthy();
    expect(queryChange).not.toHaveBeenCalled();
  });
});
