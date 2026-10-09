import { Component, effect, input, model, signal, ChangeDetectionStrategy } from '@angular/core';
import { Subscription, take } from 'rxjs';

import { FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  Word,
  Lemma,
  AttributeInfo,
  WordService,
  TokenCount,
} from '@myrmidon/pythia-api';

import { TokenCountsComponent } from '../token-counts/token-counts.component';

/**
 * A component to display a list of counts for a specific token and
 * a set of document attributes.
 */
@Component({
  selector: 'pythia-token-counts-list',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    TokenCountsComponent,
  ],
  templateUrl: './token-counts-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './token-counts-list.component.scss',
})
export class TokenCountsListComponent {
  private _previousToken?: Word | Lemma;
  private _countsSub?: Subscription;

  /**
   * The token for which to display the counts.
   */
  public readonly token = input<Word | Lemma | undefined>();

  /**
   * Whether to display the toolbar with the attribute selection.
   */
  public readonly hideToolbar = input<boolean | undefined>();

  /**
   * The list of available attributes.
   */
  public readonly attributes = model<AttributeInfo[] | undefined>();

  public readonly busy = signal<boolean>(false);
  public readonly counts = signal<{ [key: string]: TokenCount[] }>({});
  private readonly _emptyCounts = {}; // reuse the same empty object reference

  public readonly selectedAttributes: FormControl<AttributeInfo[]>;

  constructor(
    formBuilder: FormBuilder,
    private _wordService: WordService,
  ) {
    this.selectedAttributes = formBuilder.control<AttributeInfo[]>([], {
      nonNullable: true,
    });
    effect(() => {
      const token = this.token();
      if (this.isWordOrLemmaEqual(token, this._previousToken)) {
        return;
      }
      this._previousToken = token;
      this.loadCounts(token, true);
    });
  }

  private isWordOrLemmaEqual(a?: Word | Lemma, b?: Word | Lemma): boolean {
    if (!a && !b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    if (
      a.type !== b.type ||
      a.id !== b.id ||
      a.value !== b.value ||
      a.language !== b.language ||
      a.pos !== b.pos ||
      a.count !== b.count
    ) {
      return false;
    }

    const wa = a as Word;
    const wb = b as Word;
    return wa.lemmaId === wb.lemmaId && wa.lemma === wb.lemma;
  }

  public ngOnInit(): void {
    // on first load, get the list of available attributes if not provided
    if (!this.attributes()) {
      this._wordService
        .getDocAttributeInfo()
        .pipe(take(1))
        .subscribe((attributes) => {
          this.selectedAttributes.reset();
          this.attributes.set(attributes);
        });
    }
  }

  /**
   * Load the counts for the specified token.
   *
   * @param token The token.
   * @param replace True to replace any pending load (e.g. when the token
   * changes), else do nothing while loading.
   */
  public loadCounts(token?: Word | Lemma | undefined, replace = false): void {
    if (replace) {
      this._countsSub?.unsubscribe();
      this.busy.set(false);
    }
    if (this.busy() || !token) {
      return;
    }

    if (!this.selectedAttributes.value?.length) {
      // only set counts to empty if it's not already empty
      // (use the same empty object reference to avoid unnecessary updates)
      if (Object.keys(this.counts()).length > 0) {
        this.counts.set(this._emptyCounts);
      }
      return;
    }

    this.busy.set(true);

    const names = this.selectedAttributes.value.map((i) => i.name);
    const counts$ =
      token.type === 'lemma'
        ? this._wordService.getLemmaCounts(token.id, names)
        : this._wordService.getWordCounts(token.id, names);

    this._countsSub = counts$.pipe(take(1)).subscribe({
      next: (map) => {
        this.counts.set(map);
      },
      error: (error) => {
        console.error('Error loading token counts', error);
        this.busy.set(false);
      },
      complete: () => {
        this.busy.set(false);
      },
    });
  }
}
