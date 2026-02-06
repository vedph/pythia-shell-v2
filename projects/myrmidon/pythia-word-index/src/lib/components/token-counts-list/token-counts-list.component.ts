import { Component, effect, input, Input, model, signal } from '@angular/core';
import { take } from 'rxjs';

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
  styleUrl: './token-counts-list.component.scss',
})
export class TokenCountsListComponent {
  private _previousToken?: Word | Lemma;

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
      console.log('input token', token);
      this.loadCounts(token);
    });
  }

  private isWordOrLemmaEqual(a?: Word | Lemma, b?: Word | Lemma): boolean {
    if (!a && !b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    if (a.type !== b.type) {
      return false;
    }
    if (
      a.type === 'lemma' &&
      (a.type !== b.type ||
        a.id !== b.id ||
        a.value !== b.value ||
        a.language !== b.language ||
        a.pos !== b.pos ||
        a.count !== b.count)
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

  public loadCounts(token?: Word | Lemma | undefined): void {
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

    if (token.type === 'lemma') {
      this._wordService
        .getLemmaCounts(
          token!.id,
          this.selectedAttributes.value.map((i) => i.name),
        )
        .pipe(take(1))
        .subscribe({
          next: (map) => {
            this.counts.set(map);
          },
          complete: () => {
            this.busy.set(false);
          },
        });
    } else {
      this._wordService
        .getWordCounts(
          token!.id,
          this.selectedAttributes.value.map((i) => i.name),
        )
        .pipe(take(1))
        .subscribe({
          next: (map) => {
            this.counts.set(map);
          },
          complete: () => {
            this.busy.set(false);
          },
        });
    }
  }
}
