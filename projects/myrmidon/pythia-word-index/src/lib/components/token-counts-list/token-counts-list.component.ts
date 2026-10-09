import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { Subscription, take } from 'rxjs';

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
    FormField,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltipModule,
    TokenCountsComponent,
  ],
  templateUrl: './token-counts-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
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

  private readonly _wordService = inject(WordService);

  /**
   * The attributes selection. This holds the attribute names rather than the
   * attribute objects, which belong to the caller: a form tags the object
   * items of the arrays in its value.
   */
  public readonly form = form(signal<{ names: string[] }>({ names: [] }));

  /**
   * The selected attributes, in their list order.
   */
  public readonly selectedAttributes = computed<AttributeInfo[]>(() => {
    const names = this.form.names().value();
    return (this.attributes() || []).filter((a) => names.includes(a.name));
  });

  constructor() {
    effect(() => {
      const token = this.token();
      if (this.isWordOrLemmaEqual(token, this._previousToken)) {
        return;
      }
      this._previousToken = token;
      // the selection must not become a dependency of this effect: counts
      // are loaded for it only on the user's request
      untracked(() => this.loadCounts(token, true));
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
          this.form.names().value.set([]);
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

    const selected = this.selectedAttributes();
    if (!selected.length) {
      // only set counts to empty if it's not already empty
      // (use the same empty object reference to avoid unnecessary updates)
      if (Object.keys(this.counts()).length > 0) {
        this.counts.set(this._emptyCounts);
      }
      return;
    }

    this.busy.set(true);

    const names = selected.map((i) => i.name);
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
