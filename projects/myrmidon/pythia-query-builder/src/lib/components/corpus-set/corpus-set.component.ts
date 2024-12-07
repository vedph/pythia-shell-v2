import { Component, input, model, output } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { RefLookupComponent } from '@myrmidon/cadmus-refs-lookup';

import { Corpus } from '@myrmidon/pythia-core';
import { CorpusRefLookupService } from '@myrmidon/pythia-ui';

/**
 * Corpus set editor. This allows users pick any number of corpora.
 * Whenever the set changes, the corporaChange event is emitted with
 * the array of selected corpora.
 */
@Component({
  selector: 'pythia-corpus-set',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    RefLookupComponent,
  ],
  templateUrl: './corpus-set.component.html',
  styleUrls: ['./corpus-set.component.css'],
})
export class CorpusSetComponent {
  /**
   * The preset user ID filter to apply to corpora lookup.
   */
  public readonly userId = input<string | undefined>();

  /**
   * The corpora to select from.
   */
  public readonly corpora = model<Corpus[]>([]);

  /**
   * Emitted whenever the set of corpora changes.
   */
  public readonly corporaChange = output<Corpus[]>();

  constructor(public corpusLookupService: CorpusRefLookupService) {}

  public onCorpusChange(corpus: Corpus | null): void {
    if (!corpus) {
      return;
    }
    const corpora = [...this.corpora()];
    if (corpora.find((c) => c.id === corpus.id)) {
      return;
    }
    corpora.push(corpus);
    this.corpora.set(corpora);
    this.corporaChange.emit(this.corpora());
  }

  public deleteCorpus(index: number): void {
    const corpora = [...this.corpora()];
    corpora.splice(index, 1);
    this.corpora.set(corpora);
    this.corporaChange.emit(this.corpora());
  }

  public clear(): void {
    this.corpora.set([]);
    this.corporaChange.emit(this.corpora());
  }
}
