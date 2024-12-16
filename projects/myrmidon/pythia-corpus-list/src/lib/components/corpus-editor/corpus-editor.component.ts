import { Component, effect, model, output } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthJwtService } from '@myrmidon/auth-jwt-login';
import { RefLookupComponent } from '@myrmidon/cadmus-refs-lookup';
import { CorpusFilter } from '@myrmidon/pythia-api';
import { Corpus } from '@myrmidon/pythia-core';
import { CorpusRefLookupService } from '@myrmidon/pythia-ui';

/**
 * An edited corpus. This just adds the optional ID of another
 * corpus to use as the source for the edited one (for cloning).
 */
export interface EditedCorpus extends Corpus {
  sourceId?: string;
}

/**
 * Corpus editor. This allows users to edit the corpus ID, title,
 * and description, plus optionally add to its contents the contents
 * of another corpus. In this case, users can lookup only corpora
 * belonging to them as source, unless they are admin's.
 */
@Component({
  selector: 'pythia-corpus-editor',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    RefLookupComponent,
  ],
  templateUrl: './corpus-editor.component.html',
  styleUrls: ['./corpus-editor.component.css'],
})
export class CorpusEditorComponent {
  private _sourceId?: string;
  public readonly idPrefix: string;

  /**
   * The corpus to edit.
   */
  public readonly corpus = model<EditedCorpus | undefined | null>();

  /**
   * Emitted when the editor is closed.
   */
  public readonly editorClose = output();

  public id: FormControl<string>;
  public title: FormControl<string | null>;
  public description: FormControl<string | null>;
  public clone: FormControl<boolean>;
  public form: FormGroup;

  public baseFilter?: CorpusFilter;

  constructor(
    formBuilder: FormBuilder,
    authService: AuthJwtService,
    public corpusRefLookupService: CorpusRefLookupService
  ) {
    // ID prefix for new IDs
    this.idPrefix = authService.currentUserValue?.userName || '';
    if (this.idPrefix) {
      this.idPrefix += '_';
    }
    // form
    this.id = formBuilder.control('', {
      validators: [
        Validators.required,
        Validators.maxLength(50 - this.idPrefix.length),
      ],
      nonNullable: true,
    });
    this.title = formBuilder.control(null, [
      Validators.required,
      Validators.maxLength(100),
    ]);
    this.description = formBuilder.control(null, Validators.maxLength(1000));
    // TODO: conditional validation for clone
    this.clone = formBuilder.control(false, { nonNullable: true });
    this.form = formBuilder.group({
      id: this.id,
      title: this.title,
      description: this.description,
      clone: this.clone,
    });
    // preset userId filter for corpus lookup (used in cloner)
    this.baseFilter = {
      userId: authService.isCurrentUserInRole('admin')
        ? undefined
        : authService.currentUserValue?.userName,
    };

    effect(() => {
      this.updateForm(this.corpus() || undefined);
    });
  }

  /**
   * Parse the specified corpus ID by extracting its conventional prefix
   * (=username_). The prefix is a convention used to avoid user-scoped
   * corpora to clash among different users.
   *
   * @param id The corpus ID.
   * @returns Array of 2 strings where [0]=prefix and [1]=ID.
   */
  private parseId(id?: string | null): string[] {
    if (!id) {
      return ['', ''];
    }
    const i = id.indexOf('_');
    return i === -1 ? ['', id] : [id.substring(0, i), id.substring(i + 1)];
  }

  private updateForm(corpus: Corpus | undefined): void {
    this._sourceId = undefined;
    if (!corpus) {
      this.form.reset();
      return;
    }
    const pi = this.parseId(corpus.id);
    this.id.setValue(pi[1]);
    this.title.setValue(corpus.title);
    this.description.setValue(corpus.description);
    this.form.markAsPristine();
  }

  public onCorpusChange(corpus: Corpus | null): void {
    this._sourceId = corpus?.id || undefined;
  }

  private getCorpus(): EditedCorpus {
    // patch the original corpus, because non-editable properties
    // like userId must be preserved
    return {
      ...this.corpus()!,
      id: this.idPrefix + this.id.value.trim(),
      title: this.title.value?.trim() || this.corpus()!.title,
      description: this.description.value?.trim() || '',
      sourceId: this.clone.value ? this._sourceId : undefined,
    };
  }

  public close(): void {
    this.editorClose.emit();
  }

  public save(): void {
    if (this.form.invalid || !this.corpus()) {
      return;
    }
    this.corpus.set(this.getCorpus());
  }
}
