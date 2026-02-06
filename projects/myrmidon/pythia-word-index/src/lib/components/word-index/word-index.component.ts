import { Component, input, output, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AttributeInfo, Lemma, Word } from '@myrmidon/pythia-api';

import { PagedWordTreeBrowserComponent } from '../paged-word-tree-browser/paged-word-tree-browser.component';
import { TokenCountsListComponent } from '../token-counts-list/token-counts-list.component';
import { WordTreeFilterSortOrderEntry } from '../paged-word-tree-filter/paged-word-tree-filter.component';

@Component({
  selector: 'pythia-word-index',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    PagedWordTreeBrowserComponent,
    TokenCountsListComponent,
  ],
  templateUrl: './word-index.component.html',
  styleUrl: './word-index.component.scss',
})
export class WordIndexComponent {
  public readonly token = signal<Word | Lemma | undefined>(undefined);

  /**
   * The list of attributes to display in the attribute filter.
   */
  public readonly attributes = input<AttributeInfo[] | undefined>();

  /**
   * Whether to hide the language filter.
   */
  public readonly hideLanguage = input<boolean | undefined>();

  /**
   * Whether to hide the node filter.
   */
  public readonly hideFilter = input<boolean | undefined>();

  /**
   * Whether to hide the node y,x location.
   */
  public readonly hideLoc = input<boolean | undefined>();

  /**
   * Whether to enable debug node view.
   */
  public readonly debug = input<boolean | undefined>();

  /**
   * The sort order entries to display in the sort order dropdown.
   * If not set, the sort order dropdown will use the default entries.
   */
  public readonly sortOrderEntries = input<
    WordTreeFilterSortOrderEntry[] | undefined
  >();

  /**
   * Emitted when requests a search for a word or lemma.
   */
  public readonly searchRequest = output<Word | Lemma>();

  public onSearchRequest(token: Word | Lemma): void {
    this.searchRequest.emit(token);
  }

  public onCountsRequest(token: Word | Lemma): void {
    this.token.set(token);
  }
}
