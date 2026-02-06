import { Component, effect, input, model, output } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { CorpusFilter } from '@myrmidon/pythia-api';

/**
 * Corpus filter component. This is used to filter the list
 * of corpora.
 */
@Component({
  selector: 'pythia-corpus-filter',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  templateUrl: './corpus-filter.component.html',
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

  public id: FormControl<string | null>;
  public title: FormControl<string | null>;
  public form: FormGroup;

  constructor(formBuilder: FormBuilder) {
    // form
    this.id = formBuilder.control(null);
    this.title = formBuilder.control(null);
    this.form = formBuilder.group({
      id: this.id,
      title: this.title,
    });
    effect(() => {
      this.updateForm(this.filter());
    });
  }

  private updateForm(filter?: CorpusFilter | null): void {
    if (!filter) {
      this.form.reset();
      return;
    }
    this.id.setValue(filter.id || null);
    this.title.setValue(filter.title || null);
    this.form.markAsPristine();
  }

  private getFilter(): CorpusFilter {
    return {
      id: this.id.value?.trim(),
      title: this.title.value?.trim(),
    };
  }

  public reset(): void {
    this.form.reset();
    this.filter.set({});
  }

  public apply(): void {
    this.filter.set(this.getFilter());
  }
}
