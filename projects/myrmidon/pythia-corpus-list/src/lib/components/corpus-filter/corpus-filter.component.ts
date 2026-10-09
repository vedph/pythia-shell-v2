import {
  ChangeDetectionStrategy,
  Component,
  input,
  linkedSignal,
  model,
} from '@angular/core';
import { FormField, form } from '@angular/forms/signals';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CorpusFilter } from '@myrmidon/pythia-api';

interface CorpusFilterControls {
  id: string;
  title: string;
}

function toDraft(filter?: CorpusFilter | null): CorpusFilterControls {
  return { id: filter?.id || '', title: filter?.title || '' };
}

function toModel(draft: CorpusFilterControls): CorpusFilter {
  return {
    id: draft.id.trim() || undefined,
    title: draft.title.trim() || undefined,
  };
}

/**
 * Corpus filter component. This is used to filter the list
 * of corpora.
 */
@Component({
  selector: 'pythia-corpus-filter',
  imports: [
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  templateUrl: './corpus-filter.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./corpus-filter.component.css'],
})
export class CorpusFilterComponent {
  /**
   * The filter to edit.
   */
  public readonly filter = model<CorpusFilter | null | undefined>();

  /**
   * True if the filter component is disabled.
   */
  public readonly disabled = input<boolean | undefined>();

  // the filter is applied explicitly, so any incoming filter (including
  // the echo of an applied one) just rebuilds the draft
  private readonly _draft = linkedSignal(() => toDraft(this.filter()));

  public readonly form = form(this._draft);

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
