import { Component, output, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { AuthJwtService } from '@myrmidon/auth-jwt-login';
import { RefLookupComponent } from '@myrmidon/cadmus-refs-lookup';
import { CorpusFilter } from '@myrmidon/pythia-api';
import { Corpus } from '@myrmidon/pythia-core';
import {
  CorpusRefLookupService,
  EditableCheckService,
} from '@myrmidon/pythia-ui';

export interface CorpusActionRequest {
  corpusId: string;
  action: string;
}

/**
 * Component used to add or remove a document to a corpus.
 */
@Component({
  selector: 'pythia-document-corpus',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    RefLookupComponent,
  ],
  templateUrl: './document-corpus.component.html',
  styleUrls: ['./document-corpus.component.css'],
})
export class DocumentCorpusComponent {
  public corpusId: FormControl<string | null>;
  public action: FormControl<string | null>;
  public form: FormGroup;

  public readonly corpusAction = output<CorpusActionRequest>();
  public readonly baseFilter = signal<CorpusFilter | undefined>(undefined);
  public readonly editable = signal<boolean>(false);

  constructor(
    formBuilder: FormBuilder,
    public corpusRefLookupService: CorpusRefLookupService,
    private _editableCheckService: EditableCheckService,
    authService: AuthJwtService
  ) {
    // form
    this.corpusId = formBuilder.control(null, [
      Validators.required,
      Validators.maxLength(50),
    ]);
    this.action = formBuilder.control('add-filtered', Validators.required);
    this.form = formBuilder.group({
      corpusId: this.corpusId,
      action: this.action,
    });
    // preset userId filter for corpus lookup (used in cloner)
    this.baseFilter.set({
      userId: authService.isCurrentUserInRole('admin')
        ? undefined
        : authService.currentUserValue?.userName,
    });
  }

  public onCorpusChange(corpus: unknown): void {
    this.corpusId.setValue((corpus as Corpus | undefined)?.id || null);
    this.editable.set(this._editableCheckService.isEditable(
      corpus as Corpus | undefined
    ));
  }

  public apply(): void {
    if (this.form.invalid) {
      return;
    }
    this.corpusAction.emit({
      corpusId: this.corpusId.value?.trim() || '',
      action: this.action.value || '',
    });
  }
}
