import { inputBinding, outputBinding, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { AuthJwtService } from '@myrmidon/auth-jwt-login';
import { CorpusRefLookupService } from '@myrmidon/pythia-ui';

import {
  CorpusEditorComponent,
  EditedCorpus,
} from './corpus-editor.component';

interface SetupOptions {
  corpus?: EditedCorpus | null;
  userName?: string | null;
  admin?: boolean;
}

async function setup(options: SetupOptions = {}) {
  const userName = options.userName === undefined ? 'zeus' : options.userName;
  const auth = {
    currentUserValue: userName ? { userName } : null,
    isCurrentUserInRole: vi.fn().mockReturnValue(!!options.admin),
  };
  const lookup = {
    id: 'corpus',
    lookup: vi.fn().mockReturnValue(of([])),
    getById: vi.fn().mockReturnValue(of(undefined)),
    getName: (c: EditedCorpus) => c?.title,
  };
  const corpus = signal<EditedCorpus | null | undefined>(options.corpus);
  const corpusChange = vi.fn();
  const editorClose = vi.fn();
  const result = await render(CorpusEditorComponent, {
    bindings: [
      inputBinding('corpus', corpus),
      outputBinding('corpusChange', corpusChange),
      outputBinding('editorClose', editorClose),
    ],
    providers: [
      { provide: AuthJwtService, useValue: auth },
      { provide: CorpusRefLookupService, useValue: lookup },
    ],
  });
  return {
    ...result,
    corpus,
    auth,
    corpusChange,
    editorClose,
    user: userEvent.setup(),
    component: result.fixture.componentInstance,
  };
}

const idBox = () =>
  screen.getByRole('textbox', { name: /^ID/ }) as HTMLInputElement;
const titleBox = () =>
  screen.getByRole('textbox', { name: /title/i }) as HTMLInputElement;
const descriptionBox = () =>
  screen.getByRole('textbox', { name: /description/i });
const saveButton = () => screen.getByRole('button', { name: 'Save corpus' });

describe('CorpusEditorComponent', () => {
  it('should show the current user prefix in the ID label', async () => {
    await setup();
    expect(idBox()).toBeTruthy();
    expect(screen.getByText(/ID zeus_/)).toBeTruthy();
  });

  it('should have no prefix when no user is logged in', async () => {
    const { component } = await setup({ userName: null });
    expect(component.idPrefix).toBe('');
  });

  it('should load the corpus stripping the user prefix', async () => {
    await setup({
      corpus: {
        id: 'zeus_myths',
        title: 'Myths',
        description: 'Greek myths',
        userId: 'zeus',
      },
    });
    expect((idBox() as HTMLInputElement).value).toBe('myths');
    expect((titleBox() as HTMLInputElement).value).toBe('Myths');
    expect((descriptionBox() as HTMLTextAreaElement).value).toBe(
      'Greek myths',
    );
  });

  it('should strip a user prefix containing underscores', async () => {
    await setup({
      userName: 'john_doe',
      corpus: { id: 'john_doe_c1', title: 'C1', description: '' },
    });
    expect((idBox() as HTMLInputElement).value).toBe('c1');
  });

  it('should strip another conventional prefix', async () => {
    await setup({
      admin: true,
      corpus: { id: 'hera_c2', title: 'C2', description: '' },
    });
    expect((idBox() as HTMLInputElement).value).toBe('c2');
  });

  it('should keep an ID without prefix', async () => {
    await setup({ corpus: { id: 'plain', title: 'P', description: '' } });
    expect((idBox() as HTMLInputElement).value).toBe('plain');
  });

  it('should save the edited corpus with prefix, preserving other props', async () => {
    const { user, corpusChange } = await setup({
      corpus: {
        id: 'zeus_myths',
        title: 'Myths',
        description: 'Greek myths',
        userId: 'zeus',
        documentIds: [1, 2],
      },
    });
    await user.clear(idBox());
    await user.type(idBox(), ' legends ');
    await user.clear(titleBox());
    await user.type(titleBox(), ' Legends ');
    await user.clear(descriptionBox());
    await user.click(saveButton());

    expect(corpusChange).toHaveBeenCalledWith({
      id: 'zeus_legends',
      title: 'Legends',
      description: '',
      userId: 'zeus',
      documentIds: [1, 2],
      sourceId: undefined,
    });
  });

  it('should save a new corpus from a user without underscore issues', async () => {
    const { user, corpusChange } = await setup({
      userName: 'john_doe',
      corpus: { id: 'john_doe_c1', title: 'C1', description: '' },
    });
    await user.click(saveButton());
    expect(corpusChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'john_doe_c1' }),
    );
  });

  it('should disable save and show error when ID is missing', async () => {
    const { user, corpusChange } = await setup({
      corpus: { id: '', title: 'corpus', description: '', userId: 'zeus' },
    });
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
    await user.type(idBox(), 'x');
    await user.clear(idBox());
    // Material shows errors once the control is touched
    await user.tab();
    expect(screen.getByText('ID required')).toBeTruthy();
    expect(corpusChange).not.toHaveBeenCalled();
  });

  // signal forms project maxLength onto the native maxlength attribute, so
  // typing is capped; the error still shows for an over-long bound value
  it('should cap typing in title at its max length', async () => {
    const { user } = await setup({
      corpus: { id: 'zeus_a', title: '', description: '' },
    });
    await user.type(titleBox(), 'x'.repeat(101));
    expect(titleBox().value.length).toBe(100);
  });

  it('should show an error when a bound title is too long', async () => {
    const { user } = await setup({
      corpus: { id: 'zeus_a', title: 'x'.repeat(101), description: '' },
    });
    await user.click(titleBox());
    await user.tab();
    expect(screen.getByText('title too long')).toBeTruthy();
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('should cap the ID at the room left by prefix', async () => {
    const { user } = await setup({
      corpus: { id: '', title: 'A', description: '' },
    });
    // 50 - "zeus_".length = 45
    await user.type(idBox(), 'x'.repeat(46));
    expect(idBox().value.length).toBe(45);
  });

  it('should show an error when a bound ID exceeds the room left by prefix', async () => {
    const { user } = await setup({
      corpus: { id: 'zeus_' + 'x'.repeat(46), title: 'A', description: '' },
    });
    await user.click(idBox());
    await user.tab();
    expect(screen.getByText('ID too long')).toBeTruthy();
  });

  it('should not save when there is no corpus', async () => {
    const { component, corpusChange } = await setup({ corpus: null });
    component.form.id().value.set('x');
    component.form.title().value.set('t');
    component.save();
    expect(corpusChange).not.toHaveBeenCalled();
  });

  it('should reset the form when corpus becomes null', async () => {
    const { fixture, corpus } = await setup({
      corpus: { id: 'zeus_a', title: 'A', description: 'd' },
    });
    corpus.set(null);
    await fixture.whenStable();
    expect((idBox() as HTMLInputElement).value).toBe('');
    expect((titleBox() as HTMLInputElement).value).toBe('');
  });

  it('should render no <form> element, so it stays valid at any nesting depth', async () => {
    const { fixture } = await setup();
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('should not save on Enter in an input', async () => {
    const { user, corpusChange } = await setup({
      corpus: { id: 'zeus_a', title: 'A', description: '' },
    });
    await user.type(titleBox(), 'b{Enter}');
    expect(corpusChange).not.toHaveBeenCalled();
  });

  it('should refuse to save an invalid draft and surface the errors', async () => {
    const { component, corpusChange } = await setup({
      corpus: { id: 'zeus_a', title: 'A', description: '' },
    });
    component.form.title().value.set('');
    component.save();
    expect(corpusChange).not.toHaveBeenCalled();
    expect(component.form.title().touched()).toBe(true);
  });

  it('should keep the draft as typed when its own save echoes back', async () => {
    const { user, fixture, component, corpusChange } = await setup({
      corpus: { id: 'zeus_a', title: 'A', description: '' },
    });
    await user.clear(titleBox());
    await user.type(titleBox(), 'abc ');
    await user.click(saveButton());
    await fixture.whenStable();

    // the model got the trimmed value...
    expect(corpusChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'abc' }),
    );
    // ...but the draft still holds what the user typed, and is pristine
    expect(titleBox().value).toBe('abc ');
    expect(component.form().dirty()).toBe(false);
  });

  it('should rebuild the draft when a different corpus is bound', async () => {
    const { user, fixture, corpus } = await setup({
      corpus: { id: 'zeus_a', title: 'A', description: '' },
    });
    await user.click(screen.getByRole('checkbox', { name: 'clone' }));
    await user.type(titleBox(), 'x');
    corpus.set({ id: 'zeus_b', title: 'B', description: '' });
    await fixture.whenStable();
    expect(idBox().value).toBe('b');
    expect(titleBox().value).toBe('B');
    expect(
      (screen.getByRole('checkbox', { name: 'clone' }) as HTMLInputElement)
        .checked,
    ).toBe(false);
  });

  it('should emit editorClose on close', async () => {
    const { user, editorClose } = await setup();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(editorClose).toHaveBeenCalledTimes(1);
  });

  describe('cloning', () => {
    it('should show the source lookup only when clone is checked', async () => {
      const { user } = await setup({
        corpus: { id: 'zeus_a', title: 'A', description: '' },
      });
      expect(screen.queryByRole('group', { name: 'clone from' })).toBeNull();
      await user.click(screen.getByRole('checkbox', { name: 'clone' }));
      expect(screen.getByRole('group', { name: 'clone from' })).toBeTruthy();
    });

    it('should restrict the lookup to the user corpora', async () => {
      const { component } = await setup();
      expect(component.baseFilter()).toEqual({ userId: 'zeus' });
    });

    it('should not restrict the lookup for admin', async () => {
      const { component } = await setup({ admin: true });
      expect(component.baseFilter()).toEqual({ userId: undefined });
    });

    it('should save source ID only when clone is checked', async () => {
      const { user, component, corpusChange } = await setup({
        corpus: { id: 'zeus_a', title: 'A', description: '' },
      });
      component.onCorpusChange({ id: 'zeus_src', title: 'S', description: '' });
      await user.click(saveButton());
      expect(corpusChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ sourceId: undefined }),
      );

      await user.click(screen.getByRole('checkbox', { name: 'clone' }));
      component.onCorpusChange({ id: 'zeus_src', title: 'S', description: '' });
      await user.click(saveButton());
      expect(corpusChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: 'zeus_a', sourceId: 'zeus_src' }),
      );
    });

    it('should clear source ID when lookup is cleared', async () => {
      const { user, component, corpusChange } = await setup({
        corpus: { id: 'zeus_a', title: 'A', description: '' },
      });
      await user.click(screen.getByRole('checkbox', { name: 'clone' }));
      component.onCorpusChange({ id: 'zeus_src', title: 'S', description: '' });
      component.onCorpusChange(undefined);
      await user.click(saveButton());
      expect(corpusChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ sourceId: undefined }),
      );
    });
  });
});
