import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  model,
  signal,
  untracked,
} from '@angular/core';
import { FormField, form, maxLength, min } from '@angular/forms/signals';

import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { WordFilter, WordSortOrder } from '@myrmidon/pythia-api';

export interface WordTreeFilterSortOrderEntry {
  key: string;
  value: WordSortOrder;
  descending?: boolean;
}

const DEFAULT_SORT_ORDER_ENTRIES: WordTreeFilterSortOrderEntry[] = [
  // ascending
  { key: $localize`▲ default`, value: WordSortOrder.Default },
  { key: $localize`▲ value`, value: WordSortOrder.ByValue },
  { key: $localize`▲ reversed value`, value: WordSortOrder.ByReversedValue },
  { key: $localize`▲ frequency`, value: WordSortOrder.ByCount },
  // descending
  {
    key: $localize`▼ default `,
    value: WordSortOrder.Default,
    descending: true,
  },
  { key: $localize`▼ value`, value: WordSortOrder.ByValue, descending: true },
  {
    key: $localize`▼ reversed value`,
    value: WordSortOrder.ByReversedValue,
    descending: true,
  },
  {
    key: $localize`▼ frequency`,
    value: WordSortOrder.ByCount,
    descending: true,
  },
];

interface PagedWordTreeFilterControls {
  language: string;
  pos: string | null;
  valuePattern: string;
  minValueLength: number | null;
  maxValueLength: number | null;
  minCount: number | null;
  maxCount: number | null;
  sortOrder: WordTreeFilterSortOrderEntry;
}

/**
 * Bound filter -> draft.
 * @param filter The filter.
 * @param entries The available sort order entries.
 */
function toDraft(
  filter: WordFilter | null | undefined,
  entries: WordTreeFilterSortOrderEntry[],
): PagedWordTreeFilterControls {
  return {
    language: filter?.language ?? '',
    pos: filter?.pos ?? null,
    // the filter uses SQL wildcards, while the UI uses * and ?
    valuePattern: filter?.valuePattern
      ? filter.valuePattern.replace(/%/g, '*').replace(/_/g, '?')
      : '',
    minValueLength: filter?.minValueLength ?? 0,
    maxValueLength: filter?.maxValueLength ?? 0,
    minCount: filter?.minCount ?? 0,
    maxCount: filter?.maxCount ?? 0,
    sortOrder:
      (filter &&
        entries.find(
          (e) =>
            e.value === (filter.sortOrder ?? WordSortOrder.Default) &&
            !!e.descending === !!filter.isSortDescending,
        )) ??
      entries[0] ??
      DEFAULT_SORT_ORDER_ENTRIES[0],
  };
}

/**
 * Draft -> filter.
 * @param draft The draft.
 * @param entries The available sort order entries.
 */
function toModel(
  draft: PagedWordTreeFilterControls,
  entries: WordTreeFilterSortOrderEntry[],
): WordFilter {
  const sortOrderEntry =
    entries.find((e) => e.key === draft.sortOrder.key) || entries[0];

  return {
    language: draft.language || undefined,
    pos: draft.pos ?? undefined,
    valuePattern: draft.valuePattern
      ? draft.valuePattern.replace(/\*/g, '%').replace(/\?/g, '_')
      : undefined,
    minValueLength: draft.minValueLength || undefined,
    maxValueLength: draft.maxValueLength || undefined,
    minCount: draft.minCount || undefined,
    maxCount: draft.maxCount || undefined,
    sortOrder: sortOrderEntry.value,
    isSortDescending: sortOrderEntry.descending,
  };
}

@Component({
  selector: 'pythia-paged-word-tree-filter',
  imports: [
    FormField,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './paged-word-tree-filter.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './paged-word-tree-filter.component.scss',
})
export class PagedWordTreeFilterComponent {
  /**
   * The sort order entries to display in the sort order dropdown.
   */
  public readonly sortOrderEntries = input<WordTreeFilterSortOrderEntry[]>(
    DEFAULT_SORT_ORDER_ENTRIES,
  );
  public readonly sortEntries = computed(() => {
    return this.sortOrderEntries()?.length
      ? this.sortOrderEntries()
      : DEFAULT_SORT_ORDER_ENTRIES;
  });

  /**
   * Whether to hide the language filter.
   */
  public readonly hideLanguage = input<boolean | undefined>();

  /**
   * Whether to hide the part of speech filter.
   */
  public readonly hidePos = input<boolean | undefined>();

  /**
   * The filter.
   */
  public readonly filter = model<WordFilter | null | undefined>();

  // for dialog wrapper:
  public readonly dialogRef = inject<
    MatDialogRef<PagedWordTreeFilterComponent>
  >(MatDialogRef, { optional: true });
  public readonly data = inject<any>(MAT_DIALOG_DATA, { optional: true });

  public readonly wrapped = signal<boolean>(!!this.dialogRef);

  // the filter is applied explicitly, so any incoming filter rebuilds the
  // draft
  private readonly _draft = linkedSignal(() =>
    toDraft(
      this.filter(),
      untracked(() => this.sortEntries()),
    ),
  );

  public readonly form = form(this._draft, (path) => {
    maxLength(path.language, 50);
    maxLength(path.valuePattern, 500);
    min(path.minValueLength, 0);
    min(path.maxValueLength, 0);
    min(path.minCount, 0);
    min(path.maxCount, 0);
  });

  constructor() {
    // bind dialog data if any
    if (this.data) {
      this.filter.set(this.data.filter);
    }

    effect(() => {
      // update sort order value if it is not in the new entries
      const entries = this.sortEntries();
      untracked(() => {
        const sortOrder = this.form.sortOrder().value();
        if (
          !entries.some(
            (e) =>
              e.value === sortOrder.value &&
              e.descending === sortOrder.descending,
          )
        ) {
          this.form.sortOrder().value.set(entries[0]);
        }
      });
    });
  }

  public reset(): void {
    this.filter.set({});
    this.dialogRef?.close(null);
  }

  public apply(): void {
    // also reached by Enter, which used to be blocked by the disabled
    // submit button
    if (this.form().invalid()) {
      return;
    }
    this.filter.set(toModel(this._draft(), this.sortEntries()));
    this.dialogRef?.close(this.filter());
  }
}
