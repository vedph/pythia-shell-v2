import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AuthJwtService } from '@myrmidon/auth-jwt-login';
import { DialogService } from '@myrmidon/ngx-mat-tools';
import { CorpusFilter, CorpusService } from '@myrmidon/pythia-api';
import { Corpus } from '@myrmidon/pythia-core';
import { CorpusRefLookupService } from '@myrmidon/pythia-ui';

import { CorpusListComponent } from './corpus-list.component';

const CORPORA: Corpus[] = Array.from({ length: 25 }, (_, i) => ({
  id: `${i % 2 ? 'hera' : 'zeus'}_c${i}`,
  title: `Corpus ${i}`,
  description: '',
  userId: i % 2 ? 'hera' : 'zeus',
}));

function pageOf(pageNumber: number, pageSize: number) {
  const items = CORPORA.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
  return {
    items,
    pageNumber,
    pageSize,
    pageCount: Math.ceil(CORPORA.length / pageSize),
    total: CORPORA.length,
  };
}

async function setup(options: { admin?: boolean; confirm?: boolean } = {}) {
  const corpusService = {
    getCorpora: vi.fn((_f: CorpusFilter, n: number, s: number) =>
      of(pageOf(n, s)),
    ),
    addCorpus: vi.fn((c: Corpus) => of(c)),
    deleteCorpus: vi.fn(() => of(null)),
  };
  const auth = {
    currentUserValue: { userName: 'zeus' },
    isCurrentUserInRole: vi.fn().mockReturnValue(!!options.admin),
  };
  const dialog = {
    confirm: vi.fn().mockReturnValue(of(options.confirm ?? true)),
  };
  const snackbar = { open: vi.fn() };
  const result = await render(CorpusListComponent, {
    providers: [
      { provide: CorpusService, useValue: corpusService },
      { provide: AuthJwtService, useValue: auth },
      { provide: DialogService, useValue: dialog },
      { provide: MatSnackBar, useValue: snackbar },
      {
        provide: CorpusRefLookupService,
        useValue: { id: 'corpus', lookup: () => of([]), getName: () => '' },
      },
    ],
  });
  await result.fixture.whenStable();
  return {
    ...result,
    corpusService,
    auth,
    dialog,
    snackbar,
    user: userEvent.setup(),
  };
}

const rows = () =>
  within(screen.getAllByRole('rowgroup')[1]).queryAllByRole('row');

/**
 * Get the row of the corpus with the specified title.
 */
const rowOf = (title: string) =>
  rows().find((r) => within(r).queryByText(title, { exact: true }))!;

const rowButton = (title: string, name: string) =>
  within(rowOf(title)).getByRole('button', { name });

const queryRowButton = (title: string, name: string) =>
  within(rowOf(title)).queryByRole('button', { name });

describe('CorpusListComponent', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));

  describe('loading', () => {
    it('should load only the user corpora once for non-admin', async () => {
      const { corpusService } = await setup();
      expect(corpusService.getCorpora).toHaveBeenCalledTimes(1);
      expect(corpusService.getCorpora).toHaveBeenCalledWith(
        { userId: 'zeus' },
        1,
        20,
      );
      expect(rows().length).toBe(20);
    });

    it('should load all corpora for admin and show user column', async () => {
      const { corpusService } = await setup({ admin: true });
      expect(corpusService.getCorpora).toHaveBeenCalledTimes(1);
      expect(corpusService.getCorpora).toHaveBeenCalledWith({}, 1, 20);
      expect(screen.getByRole('columnheader', { name: 'user' })).toBeTruthy();
      expect(within(rows()[1]).getByText('hera')).toBeTruthy();
    });

    it('should not show user column for non-admin', async () => {
      await setup();
      expect(screen.queryByRole('columnheader', { name: 'user' })).toBeNull();
    });

    it('should reload on refresh', async () => {
      const { user, corpusService } = await setup();
      await user.click(screen.getByRole('button', { name: 'Refresh list' }));
      expect(corpusService.getCorpora).toHaveBeenCalledTimes(2);
      expect(corpusService.getCorpora).toHaveBeenLastCalledWith(
        { userId: 'zeus' },
        1,
        20,
      );
    });
  });

  describe('editability', () => {
    it('should show edit and delete only for own corpora', async () => {
      await setup();
      expect(
        rowButton('Corpus 0', 'Edit corpus'),
      ).toBeTruthy();
      expect(
        rowButton('Corpus 0', 'Delete corpus'),
      ).toBeTruthy();
      expect(
        queryRowButton('Corpus 1', 'Edit corpus'),
      ).toBeNull();
      expect(
        queryRowButton('Corpus 1', 'Delete corpus'),
      ).toBeNull();
    });

    it('should allow admin to edit any corpus', async () => {
      await setup({ admin: true });
      expect(
        rowButton('Corpus 1', 'Edit corpus'),
      ).toBeTruthy();
    });
  });

  describe('filtering', () => {
    it('should add the user ID to the filter for non-admin', async () => {
      const { user, corpusService } = await setup();
      await user.type(screen.getByRole('textbox', { name: 'ID' }), 'c1');
      await user.click(screen.getByRole('button', { name: 'Apply filters' }));
      expect(corpusService.getCorpora).toHaveBeenLastCalledWith(
        { id: 'c1', title: undefined, userId: 'zeus' },
        1,
        20,
      );
    });

    it('should not add the user ID to the filter for admin', async () => {
      const { user, corpusService } = await setup({ admin: true });
      await user.type(screen.getByRole('textbox', { name: 'title' }), 'x');
      await user.click(screen.getByRole('button', { name: 'Apply filters' }));
      expect(corpusService.getCorpora).toHaveBeenLastCalledWith(
        { id: undefined, title: 'x' },
        1,
        20,
      );
    });
  });

  describe('paging', () => {
    it('should load the next page', async () => {
      const { user, corpusService } = await setup();
      await user.click(screen.getByRole('button', { name: 'Next page' }));
      expect(corpusService.getCorpora).toHaveBeenLastCalledWith(
        { userId: 'zeus' },
        2,
        20,
      );
      expect(rows().length).toBe(5);
    });

    it('should reload pages when the page size changes', async () => {
      const { user, corpusService } = await setup();
      await user.click(screen.getByRole('combobox'));
      await user.click(await screen.findByRole('option', { name: '5' }));
      expect(corpusService.getCorpora).toHaveBeenLastCalledWith(
        { userId: 'zeus' },
        1,
        5,
      );
      expect(rows().length).toBe(5);
    });
  });

  describe('deleting', () => {
    it('should delete after confirmation and reload', async () => {
      const { user, corpusService, dialog } = await setup();
      await user.click(
        rowButton('Corpus 0', 'Delete corpus'),
      );
      expect(dialog.confirm).toHaveBeenCalledWith(
        'Confirm',
        'Delete corpus Corpus 0?',
      );
      expect(corpusService.deleteCorpus).toHaveBeenCalledWith('zeus_c0');
      expect(corpusService.getCorpora).toHaveBeenCalledTimes(2);
    });

    it('should not delete without confirmation', async () => {
      const { user, corpusService } = await setup({ confirm: false });
      await user.click(
        rowButton('Corpus 0', 'Delete corpus'),
      );
      expect(corpusService.deleteCorpus).not.toHaveBeenCalled();
    });

    it('should notify delete errors', async () => {
      const { user, corpusService, snackbar } = await setup();
      corpusService.deleteCorpus.mockReturnValue(
        throwError(() => 'error') as never,
      );
      await user.click(
        rowButton('Corpus 0', 'Delete corpus'),
      );
      expect(snackbar.open).toHaveBeenCalledWith('Error deleting corpus', 'OK');
    });
  });

  describe('editing', () => {
    it('should add a new corpus', async () => {
      const { user, corpusService } = await setup();
      await user.click(screen.getByRole('button', { name: 'Add corpus' }));
      await user.type(screen.getByRole('textbox', { name: /^ID zeus_/ }), 'new');
      await user.click(screen.getByRole('button', { name: 'Save corpus' }));
      expect(corpusService.addCorpus).toHaveBeenCalledWith(
        {
          id: 'zeus_new',
          title: 'corpus',
          description: '',
          userId: 'zeus',
          sourceId: undefined,
        },
        undefined,
      );
      // reloaded after save
      expect(corpusService.getCorpora).toHaveBeenCalledTimes(2);
    });

    it('should edit an existing corpus', async () => {
      const { user, corpusService } = await setup();
      await user.click(
        rowButton('Corpus 2', 'Edit corpus'),
      );
      // the filter title box comes first, the editor one last
      const titles = screen.getAllByRole('textbox', { name: 'title' });
      const editorTitle = titles[titles.length - 1] as HTMLInputElement;
      expect(editorTitle.value).toBe('Corpus 2');
      await user.clear(editorTitle);
      await user.type(editorTitle, 'Renamed');
      await user.click(screen.getByRole('button', { name: 'Save corpus' }));
      expect(corpusService.addCorpus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'zeus_c2', title: 'Renamed' }),
        undefined,
      );
    });

    it('should not edit when no user is logged in', async () => {
      const { user, auth, corpusService } = await setup();
      (auth as { currentUserValue: unknown }).currentUserValue = null;
      await user.click(
        rowButton('Corpus 2', 'Edit corpus'),
      );
      const titles = screen.getAllByRole('textbox', { name: 'title' });
      expect((titles[titles.length - 1] as HTMLInputElement).value).toBe('');
      await user.click(screen.getByRole('button', { name: 'Add corpus' }));
      expect((titles[titles.length - 1] as HTMLInputElement).value).toBe('');
      expect(corpusService.addCorpus).not.toHaveBeenCalled();
    });

    it('should close the editor without saving', async () => {
      const { user, corpusService } = await setup();
      await user.click(
        rowButton('Corpus 2', 'Edit corpus'),
      );
      await user.click(screen.getByRole('button', { name: 'Close' }));
      const titles = screen.getAllByRole('textbox', { name: 'title' });
      expect((titles[titles.length - 1] as HTMLInputElement).value).toBe('');
      expect(corpusService.addCorpus).not.toHaveBeenCalled();
    });

    it('should notify save errors', async () => {
      const { user, corpusService, snackbar } = await setup();
      corpusService.addCorpus.mockReturnValue(throwError(() => 'error') as never);
      await user.click(
        rowButton('Corpus 2', 'Edit corpus'),
      );
      await user.click(screen.getByRole('button', { name: 'Save corpus' }));
      expect(snackbar.open).toHaveBeenCalledWith('Error saving corpus', 'OK');
    });
  });
});
