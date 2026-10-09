import { inputBinding, outputBinding, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, Subject } from 'rxjs';

import {
  CorpusService,
  DocumentFilter,
  ProfileService,
} from '@myrmidon/pythia-api';
import { Corpus, Profile } from '@myrmidon/pythia-core';
import {
  CorpusRefLookupService,
  ProfileRefLookupService,
} from '@myrmidon/pythia-ui';

import {
  DocumentFilterComponent,
  DocumentFilters,
} from './document-filter.component';

const CORPUS: Corpus = { id: 'c1', title: 'Alpha', description: '' };
const PROFILE: Profile = { id: 'tei' };

interface SetupOptions {
  filter?: DocumentFilter | null;
  attributes?: string[] | null;
  hiddenFilters?: DocumentFilters;
  sortable?: boolean;
  disabled?: boolean;
}

async function setup(options: SetupOptions = {}) {
  const filter = signal<DocumentFilter | null | undefined>(options.filter);
  const attributes = signal<string[] | null | undefined>(options.attributes);
  const hiddenFilters = signal<DocumentFilters | undefined>(
    options.hiddenFilters,
  );
  const sortable = signal<boolean | undefined>(options.sortable ?? true);
  const disabled = signal<boolean | undefined>(options.disabled);
  const filterChange = vi.fn();
  const corpusService = { getCorpus: vi.fn().mockReturnValue(of(CORPUS)) };
  const profileService = { getProfile: vi.fn().mockReturnValue(of(PROFILE)) };
  const result = await render(DocumentFilterComponent, {
    bindings: [
      inputBinding('filter', filter),
      inputBinding('attributes', attributes),
      inputBinding('hiddenFilters', hiddenFilters),
      inputBinding('sortable', sortable),
      inputBinding('disabled', disabled),
      outputBinding('filterChange', filterChange),
    ],
    providers: [
      { provide: CorpusService, useValue: corpusService },
      { provide: ProfileService, useValue: profileService },
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
        useValue: {
          id: 'profile',
          lookup: () => of([PROFILE]),
          getName: (p?: Profile) => p?.id ?? '',
        },
      },
    ],
  });
  await result.fixture.whenStable();
  return {
    ...result,
    filter,
    attributes,
    filterChange,
    corpusService,
    profileService,
    user: userEvent.setup(),
  };
}

const box = (name: string | RegExp) =>
  screen.getByRole('textbox', { name }) as HTMLInputElement;
const apply = () => screen.getByRole('button', { name: 'Apply filters' });

/** The last emitted filter. */
const lastFilter = (fn: ReturnType<typeof vi.fn>): DocumentFilter =>
  fn.mock.calls[fn.mock.calls.length - 1][0];

describe('DocumentFilterComponent', () => {
  it('should render all filters by default, except attributes', async () => {
    await setup();
    expect(box('author(s)')).toBeTruthy();
    expect(box('title')).toBeTruthy();
    expect(box('source')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'corpus' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'profile' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'date' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'modified' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'sort order' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /attributes/ })).toBeNull();
  });

  it('should hide the requested filters', async () => {
    await setup({
      attributes: ['genre'],
      sortable: false,
      hiddenFilters: {
        corpus: true,
        author: true,
        title: true,
        source: true,
        profile: true,
        date: true,
        modified: true,
        attributes: true,
      },
    });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'corpus' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'profile' })).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('should emit a trimmed filter on apply', async () => {
    const { user, filterChange } = await setup();
    await user.type(box('author(s)'), ' Homer ');
    await user.type(box('title'), ' Iliad ');
    await user.type(box('source'), ' x.xml ');
    const [min, max] = screen.getAllByRole('spinbutton');
    await user.type(min, '-800');
    await user.type(max, '100');
    await user.click(apply());
    expect(filterChange).toHaveBeenCalledWith({
      corpusId: undefined,
      author: 'Homer',
      title: 'Iliad',
      source: 'x.xml',
      profileId: undefined,
      minDateValue: -800,
      maxDateValue: 100,
      minTimeModified: undefined,
      maxTimeModified: undefined,
      attributes: undefined,
      sortOrder: 0,
      descending: false,
    });
  });

  it('should emit sort order and direction', async () => {
    const { user, filterChange } = await setup();
    await user.click(screen.getByRole('combobox', { name: 'sort' }));
    await user.click(await screen.findByRole('option', { name: 'title' }));
    await user.click(screen.getByRole('checkbox', { name: 'descending' }));
    await user.click(apply());
    expect(lastFilter(filterChange)).toEqual(
      expect.objectContaining({ sortOrder: 2, descending: true }),
    );
  });

  it('should emit the picked corpus and profile', async () => {
    const { user, filterChange } = await setup();
    await user.click(screen.getByRole('button', { name: 'corpus' }));
    await user.type(screen.getByPlaceholderText('corpus'), 'a');
    await user.click(await screen.findByRole('option', { name: 'Alpha' }));
    await user.click(screen.getByRole('button', { name: 'profile' }));
    await user.type(screen.getByPlaceholderText('profile'), 't');
    await user.click(await screen.findByRole('option', { name: 'tei' }));
    await user.click(apply());
    expect(lastFilter(filterChange)).toEqual(
      expect.objectContaining({ corpusId: 'c1', profileId: 'tei' }),
    );
  });

  it('should remove the corpus filter', async () => {
    const { user, filterChange } = await setup({ filter: { corpusId: 'c1' } });
    await user.click(
      screen.getByRole('button', { name: 'Remove corpus filter' }),
    );
    await user.click(apply());
    expect(lastFilter(filterChange).corpusId).toBeUndefined();
  });

  it('should remove the profile filter via its chip', async () => {
    const { user, filterChange } = await setup({
      filter: { profileId: 'tei' },
    });
    await user.click(
      screen.getByRole('button', { name: 'Remove profile filter' }),
    );
    expect(
      screen.queryByRole('button', { name: 'Remove profile filter' }),
    ).toBeNull();
    await user.click(apply());
    expect(lastFilter(filterChange).profileId).toBeUndefined();
  });

  describe('loading a filter', () => {
    it('should load scalar values', async () => {
      await setup({
        filter: { author: 'Homer', title: 'Iliad', source: 's' },
      });
      expect(box('author(s)').value).toBe('Homer');
      expect(box('title').value).toBe('Iliad');
      expect(box('source').value).toBe('s');
    });

    it('should load corpus alone', async () => {
      const { corpusService, filterChange, user } = await setup({
        filter: { corpusId: 'c1' },
      });
      expect(corpusService.getCorpus).toHaveBeenCalledWith('c1', true);
      await user.click(apply());
      expect(lastFilter(filterChange).corpusId).toBe('c1');
    });

    it('should load profile alone', async () => {
      const { profileService, filterChange, user } = await setup({
        filter: { profileId: 'tei' },
      });
      expect(profileService.getProfile).toHaveBeenCalledWith('tei');
      expect(
        screen.getByRole('button', { name: 'Remove profile filter' }),
      ).toBeTruthy();
      await user.click(apply());
      expect(lastFilter(filterChange).profileId).toBe('tei');
    });

    it('should not refetch an unchanged corpus', async () => {
      const { corpusService, filter, fixture } = await setup({
        filter: { corpusId: 'c1' },
      });
      filter.set({ corpusId: 'c1', author: 'x' });
      await fixture.whenStable();
      expect(corpusService.getCorpus).toHaveBeenCalledTimes(1);
    });

    it('should clear corpus when the new filter has none', async () => {
      const { filter, fixture, user, filterChange } = await setup({
        filter: { corpusId: 'c1' },
      });
      filter.set({ author: 'x' });
      await fixture.whenStable();
      await user.click(apply());
      expect(lastFilter(filterChange).corpusId).toBeUndefined();
    });

    it('should reset the form for a null filter', async () => {
      const { filter, fixture } = await setup({ filter: { author: 'a' } });
      filter.set(null);
      await fixture.whenStable();
      expect(box('author(s)').value).toBe('');
    });
  });

  describe('attributes', () => {
    it('should load attributes from filter', async () => {
      const { user, filterChange } = await setup({
        attributes: ['genre', 'period'],
        filter: { attributes: 'genre=epic,period=archaic' },
      });
      const values = screen.getAllByRole('textbox', { name: 'value' });
      expect(values.map((v) => (v as HTMLInputElement).value)).toEqual([
        'epic',
        'archaic',
      ]);
      await user.click(apply());
      expect(lastFilter(filterChange).attributes).toBe(
        'genre=epic,period=archaic',
      );
    });

    it('should add and remove attribute filters', async () => {
      const { user, filterChange } = await setup({ attributes: ['genre'] });
      await user.click(
        screen.getByRole('button', { name: 'Add an attribute filter' }),
      );
      await user.click(screen.getByRole('combobox', { name: 'name' }));
      await user.click(await screen.findByRole('option', { name: 'genre' }));
      await user.type(screen.getByRole('textbox', { name: 'value' }), ' epic ');
      await user.click(apply());
      expect(lastFilter(filterChange).attributes).toBe('genre=epic');

      await user.click(
        screen.getByRole('button', { name: 'Remove this attribute' }),
      );
      await user.click(apply());
      expect(lastFilter(filterChange).attributes).toBeUndefined();
    });

    it('should skip incomplete attribute filters', async () => {
      const { user, filterChange } = await setup({ attributes: ['genre'] });
      await user.click(
        screen.getByRole('button', { name: 'Add an attribute filter' }),
      );
      await user.click(screen.getByRole('combobox', { name: 'name' }));
      await user.click(await screen.findByRole('option', { name: 'genre' }));
      await user.click(apply());
      // no "genre=undefined"
      expect(lastFilter(filterChange).attributes).toBeUndefined();
    });

    // signal forms project maxLength onto the native maxlength attribute
    it('should cap a too long value', async () => {
      const { user } = await setup({ attributes: ['genre'] });
      await user.click(
        screen.getByRole('button', { name: 'Add an attribute filter' }),
      );
      const value = screen.getByRole('textbox', {
        name: 'value',
      }) as HTMLInputElement;
      await user.type(value, 'x'.repeat(101));
      expect(value.value.length).toBe(100);
    });

    it('should show an error for a missing name once touched', async () => {
      const { user } = await setup({ attributes: ['genre'] });
      await user.click(
        screen.getByRole('button', { name: 'Add an attribute filter' }),
      );
      screen.getByRole('combobox', { name: 'name' }).focus();
      await user.tab();
      expect(screen.getByText('name required')).toBeTruthy();
    });
  });

  describe('submission', () => {
    it('should render no <form> element', async () => {
      const { fixture } = await setup();
      expect(fixture.nativeElement.querySelector('form')).toBeNull();
    });

    it('should apply filter on Enter', async () => {
      const { user, filterChange } = await setup();
      await user.type(box('author(s)'), 'Homer{Enter}');
      expect(lastFilter(filterChange).author).toBe('Homer');
    });

    it('should not apply filter on Enter when disabled', async () => {
      const { user, filterChange } = await setup({ disabled: true });
      await user.type(box('author(s)'), 'Homer{Enter}');
      expect(filterChange).not.toHaveBeenCalled();
    });
  });

  it('should ignore a corpus load superseded by a new filter', async () => {
    const { corpusService, filter, fixture, user, filterChange } =
      await setup();
    const pending = new Subject<Corpus>();
    corpusService.getCorpus.mockReturnValue(pending);
    filter.set({ corpusId: 'c1' });
    await fixture.whenStable();
    filter.set({ author: 'x' });
    await fixture.whenStable();
    pending.next(CORPUS);
    await user.click(apply());
    expect(lastFilter(filterChange).corpusId).toBeUndefined();
  });

  it('should keep typed values when a corpus load completes', async () => {
    const { corpusService, filter, fixture, user, filterChange } =
      await setup();
    const pending = new Subject<Corpus>();
    corpusService.getCorpus.mockReturnValue(pending);
    filter.set({ corpusId: 'c1' });
    await fixture.whenStable();
    await user.type(box('title'), 'Iliad');
    pending.next(CORPUS);
    await user.click(apply());
    expect(lastFilter(filterChange)).toEqual(
      expect.objectContaining({ corpusId: 'c1', title: 'Iliad' }),
    );
  });

  it('should reset all controls and emit an empty filter', async () => {
    const { user, filterChange } = await setup({
      attributes: ['genre'],
      filter: { author: 'a', attributes: 'genre=epic' },
    });
    await user.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(box('author(s)').value).toBe('');
    expect(screen.queryByRole('textbox', { name: 'value' })).toBeNull();
    expect(filterChange).toHaveBeenLastCalledWith({});
  });
});
