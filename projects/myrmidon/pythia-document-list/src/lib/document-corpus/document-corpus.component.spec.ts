import { outputBinding } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { AuthJwtService } from '@myrmidon/auth-jwt-login';
import { Corpus } from '@myrmidon/pythia-core';
import {
  CorpusRefLookupService,
  EditableCheckService,
} from '@myrmidon/pythia-ui';

import { DocumentCorpusComponent } from './document-corpus.component';

const CORPORA: Corpus[] = [
  { id: 'zeus_mine', title: 'Mine', description: '', userId: 'zeus' },
  { id: 'hera_hers', title: 'Hers', description: '', userId: 'hera' },
];

async function setup(admin = false) {
  const auth = {
    currentUserValue: { userName: 'zeus' },
    isCurrentUserInRole: vi.fn().mockReturnValue(admin),
  };
  const lookup = {
    id: 'corpus',
    lookup: vi.fn().mockReturnValue(of(CORPORA)),
    getById: vi.fn(),
    getName: (c?: Corpus) => c?.title ?? '',
  };
  const editable = {
    isEditable: vi.fn(
      (c?: Corpus) => !!c && (admin || c.userId === 'zeus'),
    ),
  };
  const corpusAction = vi.fn();
  const result = await render(DocumentCorpusComponent, {
    bindings: [outputBinding('corpusAction', corpusAction)],
    providers: [
      { provide: AuthJwtService, useValue: auth },
      { provide: CorpusRefLookupService, useValue: lookup },
      { provide: EditableCheckService, useValue: editable },
    ],
  });
  return {
    ...result,
    lookup,
    corpusAction,
    user: userEvent.setup(),
  };
}

async function pickCorpus(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
): Promise<void> {
  await user.click(screen.getByRole('button', { name: 'corpus' }));
  await user.type(screen.getByPlaceholderText('corpus'), title.charAt(0));
  await user.click(await screen.findByRole('option', { name: title }));
}

const applyButton = () =>
  screen.getByRole('button', { name: /apply/ }) as HTMLButtonElement;

describe('DocumentCorpusComponent', () => {
  it('should render no <form> element', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('should disable apply until a corpus is picked', async () => {
    await setup();
    expect(applyButton().disabled).toBe(true);
  });

  it('should restrict lookup to own corpora for non-admin', async () => {
    const { user, lookup } = await setup();
    await pickCorpus(user, 'Mine');
    expect(lookup.lookup).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'zeus' }),
      undefined,
    );
  });

  it('should add filtered documents to an own corpus', async () => {
    const { user, corpusAction } = await setup();
    await pickCorpus(user, 'Mine');
    expect(applyButton().disabled).toBe(false);
    await user.click(applyButton());
    expect(corpusAction).toHaveBeenCalledWith({
      corpusId: 'zeus_mine',
      action: 'add-filtered',
    });
  });

  it('should remove filtered documents from a corpus', async () => {
    const { user, corpusAction } = await setup();
    await user.click(screen.getByRole('combobox', { name: 'action' }));
    await user.click(
      await screen.findByRole('option', { name: 'delete from corpus' }),
    );
    await pickCorpus(user, 'Mine');
    await user.click(applyButton());
    expect(corpusAction).toHaveBeenCalledWith({
      corpusId: 'zeus_mine',
      action: 'del-filtered',
    });
  });

  it('should not apply to a corpus of another user', async () => {
    const { user, fixture, corpusAction } = await setup();
    await pickCorpus(user, 'Hers');
    expect(applyButton().disabled).toBe(true);
    // even if forced
    fixture.componentInstance.apply();
    expect(corpusAction).not.toHaveBeenCalled();
  });

  it('should let admin apply to any corpus', async () => {
    const { user, corpusAction } = await setup(true);
    await pickCorpus(user, 'Hers');
    await user.click(applyButton());
    expect(corpusAction).toHaveBeenCalledWith({
      corpusId: 'hera_hers',
      action: 'add-filtered',
    });
  });
});
