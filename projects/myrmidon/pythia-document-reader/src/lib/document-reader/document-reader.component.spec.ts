import { inputBinding, signal } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';

import { DocumentService, ReaderService } from '@myrmidon/pythia-api';
import {
  Document,
  DocumentReadRequest,
  TextMapNode,
} from '@myrmidon/pythia-core';

import { DocumentReaderComponent } from './document-reader.component';

const DOC: Document = {
  id: 7,
  author: 'Homer',
  title: 'Iliad',
  dateValue: 0,
  sortKey: '',
  source: '',
  profileId: 'p',
  lastModified: new Date(2020, 0, 1),
  attributes: [],
};

function buildMap(): TextMapNode {
  return {
    label: 'root',
    location: '/',
    start: 0,
    end: 100,
    children: [
      {
        label: 'book 1',
        location: '/1',
        start: 0,
        end: 50,
        children: [
          { label: 'chapter 1', location: '/1/1', start: 0, end: 20 },
          { label: 'chapter 2', location: '/1/2', start: 20, end: 50 },
        ],
      },
      { label: 'book 2', location: '/2', start: 50, end: 100 },
    ],
  };
}

async function setup(
  request?: DocumentReadRequest,
  options: { hideMap?: boolean } = {},
) {
  const req = signal<DocumentReadRequest | undefined>(request);
  const docService = { getDocument: vi.fn().mockReturnValue(of(DOC)) };
  const readerService = {
    getDocumentMap: vi.fn(() => of(buildMap())),
    getDocumentPieceFromRange: vi.fn(() => of({ text: '<p>range</p>' })),
    getDocumentPieceFromPath: vi.fn((_id: number, path: string) =>
      of({ text: `<p>text at ${path}</p>` }),
    ),
    // the real path algorithm (tested in pythia-api)
    getNodePath: (node: TextMapNode) => {
      const steps: string[] = [];
      while (node?.parent) {
        steps.unshift(node.parent.children!.indexOf(node).toString());
        node = node.parent;
      }
      return ['0', ...steps].join('.');
    },
  };
  const result = await render(DocumentReaderComponent, {
    bindings: [
      inputBinding('request', req),
      inputBinding('hideMap', signal(options.hideMap)),
    ],
    providers: [
      { provide: DocumentService, useValue: docService },
      { provide: ReaderService, useValue: readerService },
    ],
  });
  await result.fixture.whenStable();
  return {
    ...result,
    req,
    docService,
    readerService,
    user: userEvent.setup(),
  };
}

const treeNode = (label: string) =>
  screen
    .getByText(new RegExp(`${label}\\s*$`))
    .closest('pdb-browser-tree-node') as HTMLElement;

describe('DocumentReaderComponent', () => {
  it('should render nothing without request', async () => {
    const { docService } = await setup();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(docService.getDocument).not.toHaveBeenCalled();
  });

  it('should show document heading and map', async () => {
    await setup({ documentId: 7 });
    expect(
      screen.getByRole('heading', { name: 'Homer - Iliad' }),
    ).toBeTruthy();
    expect(treeNode('root')).toBeTruthy();
  });

  it('should hide the map when requested', async () => {
    await setup({ documentId: 7 }, { hideMap: true });
    expect(screen.queryByText(/root/)).toBeNull();
  });

  it('should show the text of a requested range', async () => {
    const { readerService } = await setup({ documentId: 7, start: 0, end: 9 });
    expect(readerService.getDocumentPieceFromRange).toHaveBeenCalledWith(7, 0, 9);
    expect(screen.getByText('range')).toBeTruthy();
  });

  it('should show the text of the initial path', async () => {
    await setup({ documentId: 7, initialPath: '0.1' });
    expect(screen.getByText('text at 0.1')).toBeTruthy();
  });

  it('should load the text of a clicked deep map node', async () => {
    const { user, readerService } = await setup({ documentId: 7 });
    await user.click(within(treeNode('root')).getByRole('button'));
    await screen.findByText(/book 1/);
    await user.click(within(treeNode('book 1')).getByRole('button'));
    await user.click(await screen.findByText(/chapter 2/));
    expect(readerService.getDocumentPieceFromPath).toHaveBeenLastCalledWith(
      7,
      '0.0.1',
    );
    expect(await screen.findByText('text at 0.0.1')).toBeTruthy();
  });

  it('should load the whole document text', async () => {
    const { user } = await setup({ documentId: 7 });
    await user.click(screen.getByRole('button', { name: 'Whole document' }));
    expect(await screen.findByText('text at 0')).toBeTruthy();
  });

  it('should recover from a text loading error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user, readerService } = await setup({ documentId: 7 });
    readerService.getDocumentPieceFromPath.mockReturnValueOnce(
      throwError(() => 'boom'),
    );
    await user.click(screen.getByRole('button', { name: 'Whole document' }));
    // not left busy: a further click loads
    await user.click(screen.getByRole('button', { name: 'Whole document' }));
    expect(await screen.findByText('text at 0')).toBeTruthy();
  });

  it('should reset when request is removed', async () => {
    const { req, fixture } = await setup({ documentId: 7 });
    req.set(undefined);
    await fixture.whenStable();
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
