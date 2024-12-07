import { CommonModule } from '@angular/common';
import {
  Component,
  effect,
  Inject,
  input,
  model,
  Optional,
  output,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';

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

@Component({
  selector: 'pythia-paged-word-tree-filter',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './paged-word-tree-filter.component.html',
  styleUrl: './paged-word-tree-filter.component.scss',
})
export class PagedWordTreeFilterComponent {
  /**
   * The sort order entries to display in the sort order dropdown.
   */
  public readonly sortOrderEntries = input<WordTreeFilterSortOrderEntry[]>(
    DEFAULT_SORT_ORDER_ENTRIES
  );

  /**
   * Whether to hide the language filter.
   */
  public readonly hideLanguage = input<boolean | undefined>();

  /**
   * The filter.
   */
  public readonly filter = model<WordFilter | null | undefined>();

  /**
   * Event emitted when the filter changes.
   */
  public readonly filterChange = output<WordFilter>();

  public language: FormControl<string | null>;
  public valuePattern: FormControl<string | null>;
  public minValueLength: FormControl<number>;
  public maxValueLength: FormControl<number>;
  public minCount: FormControl<number>;
  public maxCount: FormControl<number>;
  public sortOrder: FormControl<WordTreeFilterSortOrderEntry>;
  public form: FormGroup;

  public wrapped?: boolean;

  constructor(
    formBuilder: FormBuilder,
    // for dialog wrapper:
    @Optional()
    public dialogRef: MatDialogRef<PagedWordTreeFilterComponent>,
    @Optional()
    @Inject(MAT_DIALOG_DATA)
    public data: any
  ) {
    // form
    this.language = formBuilder.control<string | null>(null);
    this.valuePattern = formBuilder.control<string | null>(null);
    this.minValueLength = formBuilder.control<number>(0, { nonNullable: true });
    this.maxValueLength = formBuilder.control<number>(0, { nonNullable: true });
    this.minCount = formBuilder.control<number>(0, { nonNullable: true });
    this.maxCount = formBuilder.control<number>(0, { nonNullable: true });
    this.sortOrder = formBuilder.control<WordTreeFilterSortOrderEntry>(
      this.sortOrderEntries()[0] || DEFAULT_SORT_ORDER_ENTRIES[0],
      {
        nonNullable: true,
      }
    );
    this.form = formBuilder.group({
      language: this.language,
      valuePattern: this.valuePattern,
      minValueLength: this.minValueLength,
      maxValueLength: this.maxValueLength,
      minCount: this.minCount,
      maxCount: this.maxCount,
      sortOrder: this.sortOrder,
    });
    // dialog
    this.wrapped = dialogRef ? true : false;
    // bind dialog data if any
    if (data) {
      this.filter.set(data.filter);
    }

    effect(() => {
      // update sort order value if it is not in the new entries
      if (
        !this.sortOrderEntries().some(
          (e) =>
            e.value === this.sortOrder.value.value &&
            e.descending === this.sortOrder.value.descending
        )
      ) {
        this.sortOrder.setValue(this.sortOrderEntries()[0]);
      }
    });

    effect(() => {
      this.updateForm(this.filter());
    });
  }

  private updateForm(filter?: WordFilter | null): void {
    if (!filter) {
      this.form.reset();
      return;
    }

    this.language.setValue(filter.language ?? null);
    this.valuePattern.setValue(filter.valuePattern ?? null);
    this.minValueLength.setValue(filter.minValueLength ?? 0);
    this.maxValueLength.setValue(filter.maxValueLength ?? 0);
    this.minCount.setValue(filter.minCount ?? 0);
    this.maxCount.setValue(filter.maxCount ?? 0);
    this.sortOrder.setValue(
      this.sortOrderEntries().find(
        (e) =>
          e.value === filter.sortOrder &&
          e.descending === filter.isSortDescending
      ) ??
        this.sortOrderEntries()[0] ??
        DEFAULT_SORT_ORDER_ENTRIES[0]
    );
    this.form.markAsPristine();
  }

  private getFilter(): WordFilter {
    const sortOrderEntry =
      this.sortOrderEntries().find((e) => e.key === this.sortOrder.value.key) ||
      this.sortOrderEntries()[0];

    return {
      language: this.language.value ?? undefined,
      valuePattern: this.valuePattern.value
        ? this.valuePattern.value!.replace('*', '%').replace('?', '_')
        : undefined,
      minValueLength: this.minValueLength.value || undefined,
      maxValueLength: this.maxValueLength.value || undefined,
      minCount: this.minCount.value || undefined,
      maxCount: this.maxCount.value || undefined,
      sortOrder: sortOrderEntry.value,
      isSortDescending: sortOrderEntry.descending,
    };
  }

  public reset(): void {
    this.form.reset();
    this.filter.set({});
    this.filterChange.emit(this.filter()!);
    this.dialogRef?.close(null);
  }

  public apply(): void {
    this.filter.set(this.getFilter());
    this.filterChange.emit(this.filter()!);
    this.dialogRef?.close(this.filter());
  }
}
