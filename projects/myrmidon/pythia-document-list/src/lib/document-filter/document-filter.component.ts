import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  untracked,
} from '@angular/core';
import {
  FormField,
  applyEach,
  form,
  maxLength,
  required,
} from '@angular/forms/signals';
import { Subscription } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { RefLookupComponent } from '@myrmidon/cadmus-refs-lookup';

import {
  CorpusService,
  DocumentFilter,
  ProfileService,
} from '@myrmidon/pythia-api';
import { Attribute, Corpus, Profile } from '@myrmidon/pythia-core';
import {
  CorpusRefLookupService,
  ProfileRefLookupService,
} from '@myrmidon/pythia-ui';

/**
 * A list of available document filters in DocumentFilterComponent.
 */
export interface DocumentFilters {
  corpus?: boolean;
  author?: boolean;
  title?: boolean;
  source?: boolean;
  profile?: boolean;
  date?: boolean;
  modified?: boolean;
  attributes?: boolean;
}

interface AttributeControls {
  name: string;
  value: string;
}

/**
 * The editable shape behind the form. The corpus and profile are the
 * objects picked via lookup (or loaded from the filter's IDs); they are not
 * bound to native controls.
 */
interface DocumentFilterControls {
  corpus: Corpus | null;
  author: string;
  title: string;
  source: string;
  profile: Profile | null;
  minDateValue: number | null;
  maxDateValue: number | null;
  minTimeModified: Date | null;
  maxTimeModified: Date | null;
  attrs: AttributeControls[];
  sortOrder: number;
  descending: boolean;
}

function parseAttributes(csv?: string): AttributeControls[] {
  if (!csv) {
    return [];
  }
  const pairRegex = /^\s*([^=]+)=(.*)\s*/;
  return csv
    .split(',')
    .map((p) => pairRegex.exec(p))
    .filter((m) => m !== null)
    .map((m) => ({ name: m[1], value: m[2] }));
}

/**
 * Bound filter -> draft. The corpus and profile objects cannot be derived
 * from their IDs synchronously: the previous ones are kept when their ID is
 * unchanged, otherwise they are left null for the loader to fill.
 */
function toDraft(
  filter: DocumentFilter | null | undefined,
  previous?: DocumentFilterControls,
): DocumentFilterControls {
  const corpusId = filter?.corpusId;
  const profileId = filter?.profileId;
  return {
    corpus:
      corpusId && previous?.corpus?.id === corpusId ? previous.corpus : null,
    author: filter?.author || '',
    title: filter?.title || '',
    source: filter?.source || '',
    profile:
      profileId && previous?.profile?.id === profileId
        ? previous.profile
        : null,
    minDateValue: filter?.minDateValue || null,
    maxDateValue: filter?.maxDateValue || null,
    minTimeModified: filter?.minTimeModified || null,
    maxTimeModified: filter?.maxTimeModified || null,
    attrs: parseAttributes(filter?.attributes),
    sortOrder: filter?.sortOrder || 0,
    descending: !!filter?.descending,
  };
}

function toAttributes(attrs: AttributeControls[]): Attribute[] | undefined {
  const entries: Attribute[] = [];
  for (const a of attrs) {
    const name = a.name.trim();
    const value = a.value.trim();
    // the backend requires both name and value
    if (name && value) {
      entries.push({ targetId: 0, name, value });
    }
  }
  return entries.length ? entries : undefined;
}

function toModel(draft: DocumentFilterControls): DocumentFilter {
  return {
    corpusId: draft.corpus?.id,
    author: draft.author.trim() || undefined,
    title: draft.title.trim() || undefined,
    source: draft.source.trim() || undefined,
    profileId: draft.profile?.id,
    minDateValue: draft.minDateValue || undefined,
    maxDateValue: draft.maxDateValue || undefined,
    minTimeModified: draft.minTimeModified || undefined,
    maxTimeModified: draft.maxTimeModified || undefined,
    attributes: toAttributes(draft.attrs)
      ?.map((a) => `${a.name}=${a.value}`)
      ?.join(','),
    sortOrder: draft.sortOrder,
    descending: draft.descending,
  };
}

/**
 * Filters for the document list.
 */
@Component({
  selector: 'pythia-document-filter',
  imports: [
    FormField,
    MatButtonModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    MatTooltipModule,
    RefLookupComponent,
  ],
  templateUrl: './document-filter.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./document-filter.component.css'],
})
export class DocumentFilterComponent {
  private readonly _corpusService = inject(CorpusService);
  private readonly _profileService = inject(ProfileService);
  public readonly corpusLookupService = inject(CorpusRefLookupService);
  public readonly profileLookupService = inject(ProfileRefLookupService);

  /**
   * The filter.
   */
  public readonly filter = model<DocumentFilter | null | undefined>();

  /**
   * The list of available document attributes.
   */
  public readonly attributes = input<string[] | undefined | null>();

  /**
   * The list of document filters to be hidden.
   */
  public readonly hiddenFilters = input<DocumentFilters | undefined>();

  /**
   * Whether the filter is disabled.
   */
  public readonly disabled = input<boolean | undefined>();

  /**
   * Whether the filter is sortable.
   */
  public readonly sortable = input<boolean | undefined>(true);

  // the filter is applied explicitly, so any incoming filter rebuilds the
  // draft; `previous` only serves to reuse an already loaded corpus/profile
  private readonly _draft = linkedSignal<
    DocumentFilter | null | undefined,
    DocumentFilterControls
  >({
    source: () => this.filter(),
    computation: (filter, previous) => toDraft(filter, previous?.value),
  });

  public readonly form = form(this._draft, (path) => {
    maxLength(path.author, 500);
    maxLength(path.title, 500);
    maxLength(path.source, 500);
    applyEach(path.attrs, (attr) => {
      required(attr.name);
      maxLength(attr.value, 100);
    });
  });

  constructor() {
    // load the corpus and profile objects for the IDs of an incoming filter,
    // unless the draft already holds them
    effect((onCleanup) => {
      const filter = this.filter();
      const draft = untracked(() => this._draft());
      const subs = new Subscription();
      if (filter?.corpusId && draft.corpus?.id !== filter.corpusId) {
        subs.add(
          this._corpusService
            .getCorpus(filter.corpusId, true)
            .subscribe((corpus) =>
              this._draft.update((d) => ({ ...d, corpus: corpus || null })),
            ),
        );
      }
      if (filter?.profileId && draft.profile?.id !== filter.profileId) {
        subs.add(
          this._profileService
            .getProfile(filter.profileId)
            .subscribe((profile) =>
              this._draft.update((d) => ({ ...d, profile: profile || null })),
            ),
        );
      }
      onCleanup(() => subs.unsubscribe());
    });
  }

  public onCorpusChange(corpus: unknown): void {
    this.form.corpus().value.set((corpus as Corpus | undefined) || null);
  }

  public removeCorpus(): void {
    this.form.corpus().value.set(null);
  }

  public onProfileChange(profile: unknown): void {
    this.form.profile().value.set((profile as Profile | undefined) || null);
  }

  public onProfileRemoved(): void {
    this.form.profile().value.set(null);
  }

  //#region Attributes
  public addAttribute(item?: Attribute): void {
    this._draft.update((d) => ({
      ...d,
      attrs: [...d.attrs, { name: item?.name || '', value: item?.value || '' }],
    }));
  }

  public removeAttribute(index: number): void {
    this._draft.update((d) => ({
      ...d,
      attrs: d.attrs.filter((_, i) => i !== index),
    }));
  }
  //#endregion

  public reset(): void {
    this.filter.set({});
  }

  public apply(): void {
    // also reached by Enter, which used to be blocked by the disabled
    // submit button
    if (this.disabled()) {
      return;
    }
    this.filter.set(toModel(this._draft()));
  }
}
