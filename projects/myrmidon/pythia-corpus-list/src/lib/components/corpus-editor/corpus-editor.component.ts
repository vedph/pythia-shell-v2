import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  linkedSignal,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
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
 * The editable shape behind the form. `sourceId` is not bound to a control:
 * it is set from the corpus lookup, and lives here so that it is discarded
 * together with the rest of the draft whenever a new corpus is bound.
 */
interface CorpusEditorControls {
  id: string;
  title: string;
  description: string;
  clone: boolean;
  sourceId?: string;
}

function makeDefaultDraft(): CorpusEditorControls {
  return { id: '', title: '', description: '', clone: false };
}

/**
 * Parse the specified corpus ID by extracting its conventional prefix
 * (=username_). The prefix is a convention used to avoid user-scoped
 * corpora to clash among different users.
 *
 * @param id The corpus ID.
 * @returns Array of 2 strings where [0]=prefix and [1]=ID.
 */
function parseId(id?: string | null): string[] {
  if (!id) {
    return ['', ''];
  }
  const i = id.indexOf('_');
  return i === -1 ? ['', id] : [id.substring(0, i), id.substring(i + 1)];
}

/**
 * Bound corpus -> editable draft.
 * @param corpus The corpus.
 * @param idPrefix The current user's ID prefix.
 */
function toDraft(
  corpus: EditedCorpus | undefined | null,
  idPrefix: string,
): CorpusEditorControls {
  if (!corpus) {
    return makeDefaultDraft();
  }
  return {
    // strip the current user's prefix when present (the username itself
    // may contain underscores), else the conventional prefix
    id:
      idPrefix && corpus.id?.startsWith(idPrefix)
        ? corpus.id.substring(idPrefix.length)
        : parseId(corpus.id)[1],
    title: corpus.title || '',
    description: corpus.description || '',
    clone: false,
  };
}

/**
 * Editable draft -> corpus. The draft patches the original corpus,
 * because non-editable properties like userId must be preserved.
 * @param draft The draft.
 * @param corpus The original corpus.
 * @param idPrefix The current user's ID prefix.
 */
function toModel(
  draft: CorpusEditorControls,
  corpus: EditedCorpus,
  idPrefix: string,
): EditedCorpus {
  return {
    ...corpus,
    id: idPrefix + draft.id.trim(),
    title: draft.title.trim() || corpus.title,
    description: draft.description.trim() || '',
    sourceId: draft.clone ? draft.sourceId : undefined,
  };
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
    FormField,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    RefLookupComponent,
  ],
  templateUrl: './corpus-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./corpus-editor.component.css'],
})
export class CorpusEditorComponent {
  private readonly _authService = inject(AuthJwtService);
  public readonly corpusRefLookupService = inject(CorpusRefLookupService);

  private readonly _userName = this._authService.currentUserValue?.userName;

  /**
   * The ID prefix for new IDs (=current username_).
   */
  public readonly idPrefix = this._userName ? this._userName + '_' : '';

  /**
   * The corpus to edit.
   */
  public readonly corpus = model<EditedCorpus | undefined | null>();

  /**
   * Emitted when the editor is closed.
   */
  public readonly editorClose = output();

  /**
   * The base filter for the source corpus lookup (used in cloner):
   * non-admin users can only clone their own corpora.
   */
  public readonly baseFilter = signal<CorpusFilter | undefined>({
    userId: this._authService.isCurrentUserInRole('admin')
      ? undefined
      : this._userName,
  });

  /**
   * The editable draft, derived from `corpus`. `previous` tells an external
   * change apart from the echo of our own save: `toModel()` normalizes, so
   * without this check the echo would rebuild the draft from the
   * normalized value.
   */
  private readonly _draft = linkedSignal<
    EditedCorpus | undefined | null,
    CorpusEditorControls
  >({
    source: () => this.corpus(),
    computation: (corpus, previous) =>
      corpus &&
      previous?.source &&
      JSON.stringify(corpus) ===
        JSON.stringify(toModel(previous.value, previous.source, this.idPrefix))
        ? previous.value
        : toDraft(corpus, this.idPrefix),
  });

  public readonly form = form(this._draft, (path) => {
    required(path.id);
    maxLength(path.id, 50 - this.idPrefix.length);
    required(path.title);
    maxLength(path.title, 100);
    maxLength(path.description, 1000);
  });

  constructor() {
    // once the draft mirrors the bound corpus again there are no unsaved
    // edits, so clear touched/dirty
    effect(() => {
      const draft = this._draft();
      untracked(() => {
        if (this.isDraftInSync(draft)) {
          this.form().reset();
        }
      });
    });
  }

  /** True when the draft still mirrors the bound corpus. */
  private isDraftInSync(draft: CorpusEditorControls): boolean {
    return (
      JSON.stringify(draft) ===
      JSON.stringify(toDraft(this.corpus(), this.idPrefix))
    );
  }

  public onCorpusChange(corpus: unknown): void {
    const sourceId = (corpus as Corpus | undefined)?.id || undefined;
    this._draft.update((d) => ({ ...d, sourceId }));
  }

  public close(): void {
    this.editorClose.emit();
  }

  public save(): void {
    const corpus = this.corpus();
    if (!corpus) {
      return;
    }
    if (this.form().invalid()) {
      this.form().markAsTouched();
      return;
    }
    this.corpus.set(toModel(this._draft(), corpus, this.idPrefix));
    this.form().reset();
  }
}
