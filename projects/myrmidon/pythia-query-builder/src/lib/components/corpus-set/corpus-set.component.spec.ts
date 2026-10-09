import { inputBinding, outputBinding, signal } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { Corpus } from '@myrmidon/pythia-core';
import { CorpusRefLookupService } from '@myrmidon/pythia-ui';

import { CorpusSetComponent } from './corpus-set.component';

const CORPORA: Corpus[] = [
  { id: 'a', title: 'Alpha', description: '' },
  { id: 'b', title: 'Beta', description: '' },
];

async function setup(initial: Corpus[] = [], userId?: string) {
  const corpora = signal<Corpus[]>(initial);
  const corporaChange = vi.fn();
  const lookup = {
    id: 'corpus',
    lookup: vi.fn().mockReturnValue(of(CORPORA)),
    getName: (c?: Corpus) => c?.title ?? '',
  };
  const result = await render(CorpusSetComponent, {
    bindings: [
      inputBinding('corpora', corpora),
      inputBinding('userId', signal(userId)),
      outputBinding('corporaChange', corporaChange),
    ],
    providers: [{ provide: CorpusRefLookupService, useValue: lookup }],
  });
  return { ...result, corpora, corporaChange, lookup, user: userEvent.setup() };
}

async function pick(user: ReturnType<typeof userEvent.setup>, title: string) {
  // the inactive lookup shows the last picked corpus, or its label
  const lookupButton = screen.queryByRole('button', {
    name: /^(corpus|Alpha|Beta)$/,
  });
  if (lookupButton) {
    await user.click(lookupButton);
  }
  const input = screen.getByPlaceholderText('corpus');
  await user.clear(input);
  await user.type(input, title.charAt(0));
  await user.click(await screen.findByRole('option', { name: title }));
}

const bodyRows = () =>
  within(screen.getAllByRole('rowgroup')[1]).queryAllByRole('row');

describe('CorpusSetComponent', () => {
  it('should list the initial corpora', async () => {
    await setup(CORPORA);
    expect(bodyRows().length).toBe(2);
    expect(within(bodyRows()[1]).getByText('Beta')).toBeTruthy();
  });

  it('should add several picked corpora', async () => {
    const { user, corporaChange } = await setup();
    await pick(user, 'Alpha');
    await pick(user, 'Beta');
    expect(corporaChange).toHaveBeenLastCalledWith(CORPORA);
    expect(bodyRows().length).toBe(2);
  });

  it('should not add a corpus twice', async () => {
    const { user, corporaChange } = await setup();
    await pick(user, 'Alpha');
    await pick(user, 'Alpha');
    expect(corporaChange).toHaveBeenCalledTimes(1);
    expect(bodyRows().length).toBe(1);
  });

  it('should pass the user ID to the lookup filter', async () => {
    const { user, lookup } = await setup([], 'zeus');
    await pick(user, 'Alpha');
    expect(lookup.lookup).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'zeus' }),
      undefined,
    );
  });

  it('should ignore a cleared lookup', async () => {
    const { fixture, corporaChange } = await setup();
    fixture.componentInstance.onCorpusChange(undefined);
    expect(corporaChange).not.toHaveBeenCalled();
  });

  it('should remove a corpus', async () => {
    const { user, corporaChange } = await setup(CORPORA);
    await user.click(
      within(bodyRows()[0]).getByRole('button', { name: 'Remove corpus' }),
    );
    expect(corporaChange).toHaveBeenLastCalledWith([CORPORA[1]]);
    expect(bodyRows().length).toBe(1);
  });

  it('should remove all corpora', async () => {
    const { user, corporaChange } = await setup(CORPORA);
    await user.click(screen.getByRole('button', { name: 'Remove all corpora' }));
    expect(corporaChange).toHaveBeenLastCalledWith([]);
    expect(bodyRows().length).toBe(0);
  });
});
