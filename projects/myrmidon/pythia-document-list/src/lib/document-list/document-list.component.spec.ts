import { inputBinding, outputBinding, signal } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AuthJwtService } from '@myrmidon/auth-jwt-login';
import {
  AttributeService,
  CorpusService,
  DocumentFilter,
  DocumentService,
  ProfileService,
} from '@myrmidon/pythia-api';
import { Corpus, Document } from '@myrmidon/pythia-core';
import {
  CorpusRefLookupService,
  EditableCheckService,
  ProfileRefLookupService,
} from '@myrmidon/pythia-ui';

import { DocumentFilters } from '../document-filter/document-filter.component';
import { DocumentListComponent } from './document-list.component';

function doc(id: number): Document {
  return {
    id,
    author: `Author ${id}`,
    title: `Title ${id}`,
    dateValue: id,
    sortKey: '',
    source: `src${id}`,
    profileId: 'tei',
    lastModified: new Date(2020, 0, 1),
    attributes: [{ targetId: id, name: 'genre', value: `g${id}` }],
  };
}

const TOTAL = 25;

function pageOf(pageNumber: number, pageSize: number) {
  const items: Document[] = [];
  for (
    let i = (pageNumber - 1) * pageSize;
    i < Math.min(TOTAL, pageNumber * pageSize);
    i++
  ) {
    items.push(doc(i + 1));
  }
  return {
    items,
    pageNumber,
    pageSize,
    pageCount: Math.ceil(TOTAL / pageSize),
    total: TOTAL,
  };
}

const CORPUS: Corpus = {
  id: 'zeus_c',
  title: 'Mine',
  description: '',
  userId: 'zeus',
};

async function setup(hiddenFilters?: DocumentFilters) {
  const docService = {
    getDocuments: vi.fn((_f: DocumentFilter, n: number, s: number) =>
      of(pageOf(n, s)),
    ),
    getDocument: vi.fn((id: number) => of(doc(id))),
  };
  const corpusService = {
    getCorpus: vi.fn().mockReturnValue(of(CORPUS)),
    addDocumentsByFilter: vi.fn().mockReturnValue(of(null)),
    removeDocumentsByFilter: vi.fn().mockReturnValue(of(null)),
  };
  const snackbar = { open: vi.fn() };
  const readRequest = vi.fn();
  const result = await render(DocumentListComponent, {
    bindings: [
      inputBinding('hiddenFilters', signal(hiddenFilters)),
      outputBinding('readRequest', readRequest),
    ],
    providers: [
      { provide: DocumentService, useValue: docService },
      {
        provide: AttributeService,
        useValue: {
          getAttributeNames: () =>
            of({ items: ['genre'], pageNumber: 1, pageSize: 0, pageCount: 1, total: 1 }),
        },
      },
      {
        provide: ProfileService,
        useValue: {
          getProfiles: () =>
            of({ items: [], pageNumber: 1, pageSize: 0, pageCount: 0, total: 0 }),
          getProfile: () => of({ id: 'tei' }),
        },
      },
      { provide: CorpusService, useValue: corpusService },
      { provide: MatSnackBar, useValue: snackbar },
      {
        provide: AuthJwtService,
        useValue: {
          currentUserValue: { userName: 'zeus' },
          isCurrentUserInRole: () => false,
        },
      },
      { provide: EditableCheckService, useValue: { isEditable: () => true } },
      {
        provide: CorpusRefLookupService,
        useValue: {
          id: 'corpus',
          lookup: () => of([CORPUS]),
          getName: (c?: Corpus) => c?.title ?? '',
        },
      },
      {
        provide: ProfileRefLookupService,
        useValue: { id: 'profile', lookup: () => of([]), getName: () => '' },
      },
    ],
  });
  await result.fixture.whenStable();
  return {
    ...result,
    docService,
    corpusService,
    snackbar,
    readRequest,
    user: userEvent.setup(),
  };
}

const bodyRows = () =>
  within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');

const rowOf = (title: string) =>
  bodyRows().find((r) => within(r).queryByText(title, { exact: true }))!;

async function applyCorpusAction(
  user: ReturnType<typeof userEvent.setup>,
  remove = false,
) {
  // the corpus panel is collapsed by default
  await user.click(
    screen.getByRole('button', { name: 'corpus', expanded: false }),
  );
  const panel = within(screen.getByRole('region', { name: 'corpus' }));
  if (remove) {
    await user.click(panel.getByRole('combobox', { name: 'action' }));
    await user.click(
      await screen.findByRole('option', { name: 'delete from corpus' }),
    );
  }
  await user.click(panel.getByRole('button', { name: 'corpus' }));
  await user.type(panel.getByPlaceholderText('corpus'), 'm');
  await user.click(await screen.findByRole('option', { name: 'Mine' }));
  await user.click(panel.getByRole('button', { name: /apply/ }));
}

describe('DocumentListComponent', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));

  it('should list the first page of documents', async () => {
    const { docService } = await setup();
    expect(docService.getDocuments).toHaveBeenCalledWith({}, 1, 20);
    expect(bodyRows().length).toBe(20);
    const row = rowOf('Title 3');
    expect(within(row).getByText('Author 3')).toBeTruthy();
    expect(within(row).getByText('src3')).toBeTruthy();
  });

  it('should pass the hidden filters to the filter', async () => {
    await setup({ author: true });
    expect(screen.queryByRole('textbox', { name: 'author(s)' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'source' })).toBeTruthy();
  });

  it('should provide document attributes to the filter', async () => {
    await setup();
    expect(
      screen.getByRole('button', { name: 'Add an attribute filter' }),
    ).toBeTruthy();
  });

  it('should filter documents', async () => {
    const { user, docService } = await setup();
    await user.type(screen.getByRole('textbox', { name: 'author(s)' }), 'Ho');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    expect(docService.getDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ author: 'Ho' }),
      1,
      20,
    );
  });

  it('should page documents', async () => {
    const { user, docService } = await setup();
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(docService.getDocuments).toHaveBeenLastCalledWith({}, 2, 20);
    expect(bodyRows().length).toBe(5);
  });

  it('should reload pages when the page size changes', async () => {
    const { user, docService } = await setup();
    await user.click(
      screen.getByRole('combobox', { name: /items per page/i }),
    );
    await user.click(await screen.findByRole('option', { name: '5' }));
    expect(docService.getDocuments).toHaveBeenLastCalledWith({}, 1, 5);
    expect(bodyRows().length).toBe(5);
  });

  it('should reset the filter UI on refresh', async () => {
    const { user, docService } = await setup();
    const author = screen.getByRole('textbox', {
      name: 'author(s)',
    }) as HTMLInputElement;
    await user.type(author, 'Ho');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(docService.getDocuments).toHaveBeenLastCalledWith({}, 1, 20);
    expect(author.value).toBe('');
  });

  it('should emit a read request from a row', async () => {
    const { user, readRequest } = await setup();
    await user.click(
      within(rowOf('Title 2')).getByRole('button', { name: 'Read document' }),
    );
    expect(readRequest).toHaveBeenCalledWith({ documentId: 2 });
  });

  it('should show and close document info', async () => {
    const { user, docService, readRequest } = await setup();
    await user.click(
      within(rowOf('Title 4')).getByRole('button', {
        name: 'View document info',
      }),
    );
    expect(docService.getDocument).toHaveBeenCalledWith(4, false);
    const info = screen.getByRole('group', { name: 'Title 4' });
    expect(within(info).getByText('g4')).toBeTruthy();

    await user.click(within(info).getByRole('button', { name: /read/ }));
    expect(readRequest).toHaveBeenCalledWith({ documentId: 4 });

    await user.click(within(info).getByRole('button', { name: /close/ }));
    expect(screen.queryByRole('group', { name: 'Title 4' })).toBeNull();
  });

  describe('corpus actions', () => {
    it('should refuse corpus actions without a filter', async () => {
      const { user, corpusService, snackbar } = await setup();
      await applyCorpusAction(user);
      expect(corpusService.addDocumentsByFilter).not.toHaveBeenCalled();
      expect(snackbar.open).toHaveBeenCalledWith('No filter applied', 'OK', {
        duration: 3000,
      });
    });

    it('should add filtered documents to corpus', async () => {
      const { user, corpusService, snackbar } = await setup();
      await user.type(screen.getByRole('textbox', { name: 'title' }), 'T');
      await user.click(screen.getByRole('button', { name: 'Apply filters' }));
      await applyCorpusAction(user);
      expect(corpusService.addDocumentsByFilter).toHaveBeenCalledWith(
        'zeus_c',
        expect.objectContaining({ title: 'T' }),
      );
      expect(snackbar.open).toHaveBeenCalledWith('Corpus updated', 'OK', {
        duration: 2000,
      });
    });

    it('should remove filtered documents from corpus', async () => {
      const { user, corpusService } = await setup();
      await user.type(screen.getByRole('textbox', { name: 'title' }), 'T');
      await user.click(screen.getByRole('button', { name: 'Apply filters' }));
      await applyCorpusAction(user, true);
      expect(corpusService.removeDocumentsByFilter).toHaveBeenCalledWith(
        'zeus_c',
        expect.objectContaining({ title: 'T' }),
      );
    });

    it('should notify corpus action errors', async () => {
      const { user, corpusService, snackbar } = await setup();
      corpusService.addDocumentsByFilter.mockReturnValue(
        throwError(() => 'boom'),
      );
      await user.type(screen.getByRole('textbox', { name: 'title' }), 'T');
      await user.click(screen.getByRole('button', { name: 'Apply filters' }));
      await applyCorpusAction(user);
      expect(snackbar.open).toHaveBeenCalledWith('Error updating corpus', 'OK');
    });
  });
});
