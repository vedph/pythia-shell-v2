import { inputBinding, outputBinding, signal } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { Document } from '@myrmidon/pythia-core';

import { DocumentInfoComponent } from './document-info.component';

const DOC: Document = {
  id: 1,
  author: 'Homer',
  title: 'Iliad',
  dateValue: -750,
  sortKey: 'homer-iliad',
  source: 'iliad.xml',
  profileId: 'tei',
  lastModified: new Date(2020, 0, 2, 3, 4),
  attributes: [
    { targetId: 1, name: 'genre', value: 'epic' },
    { targetId: 1, name: 'language', value: 'grc' },
  ],
};

async function setup(document?: Document | null) {
  const doc = signal<Document | null | undefined>(document);
  const readRequest = vi.fn();
  const closeRequest = vi.fn();
  const result = await render(DocumentInfoComponent, {
    bindings: [
      inputBinding('document', doc),
      outputBinding('readRequest', readRequest),
      outputBinding('closeRequest', closeRequest),
    ],
  });
  return { ...result, doc, readRequest, closeRequest, user: userEvent.setup() };
}

describe('DocumentInfoComponent', () => {
  it('should render nothing without document', async () => {
    await setup();
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('should render document info and attributes', async () => {
    await setup(DOC);
    expect(screen.getByRole('group', { name: 'Iliad' })).toBeTruthy();
    expect(screen.getByText('Homer')).toBeTruthy();
    const rowFor = (label: string) =>
      screen.getByRole('cell', { name: label }).closest('tr')!;
    expect(within(rowFor('date value')).getByText('-750')).toBeTruthy();
    expect(within(rowFor('sort key')).getByText('homer-iliad')).toBeTruthy();
    expect(within(rowFor('source')).getByText('iliad.xml')).toBeTruthy();
    expect(within(rowFor('profile ID')).getByText('tei')).toBeTruthy();
    expect(
      within(rowFor('last modified')).getByText(/1\/2\/20, 3:04/),
    ).toBeTruthy();
    expect(within(rowFor('genre')).getByText('epic')).toBeTruthy();
    expect(within(rowFor('language')).getByText('grc')).toBeTruthy();
  });

  it('should hide when document is cleared', async () => {
    const { doc, fixture } = await setup(DOC);
    doc.set(null);
    await fixture.whenStable();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('should request reading', async () => {
    const { user, readRequest } = await setup(DOC);
    await user.click(screen.getByRole('button', { name: /read/ }));
    expect(readRequest).toHaveBeenCalledWith(DOC);
  });

  it('should request closing', async () => {
    const { user, closeRequest } = await setup(DOC);
    await user.click(screen.getByRole('button', { name: /close/ }));
    expect(closeRequest).toHaveBeenCalledWith(DOC);
  });
});
