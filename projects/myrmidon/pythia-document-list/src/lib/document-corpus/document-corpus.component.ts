import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
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
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    RefLookupComponent,
  ],
  templateUrl: './document-corpus.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./document-corpus.component.css'],
})
export class DocumentCorpusComponent {
  private readonly _editableCheckService = inject(EditableCheckService);
  private readonly _authService = inject(AuthJwtService);
  public readonly corpusRefLookupService = inject(CorpusRefLookupService);

  public readonly corpusAction = output<CorpusActionRequest>();

  // preset userId filter for corpus lookup
  public readonly baseFilter = signal<CorpusFilter | undefined>({
    userId: this._authService.isCurrentUserInRole('admin')
      ? undefined
      : this._authService.currentUserValue?.userName,
  });
  public readonly editable = signal<boolean>(false);

  // corpusId is not bound to a control: it is set from the corpus lookup
  private readonly _draft = signal({ corpusId: '', action: 'add-filtered' });

  public readonly form = form(this._draft, (path) => {
    required(path.corpusId);
    maxLength(path.corpusId, 50);
    required(path.action);
  });

  public onCorpusChange(corpus: unknown): void {
    this.form.corpusId().value.set((corpus as Corpus | undefined)?.id || '');
    this.editable.set(
      this._editableCheckService.isEditable(corpus as Corpus | undefined),
    );
  }

  public apply(): void {
    if (this.form().invalid() || !this.editable()) {
      return;
    }
    const { corpusId, action } = this._draft();
    this.corpusAction.emit({ corpusId: corpusId.trim(), action });
  }
}
