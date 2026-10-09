import {
  ChangeDetectionStrategy,
  Component,
  effect,
  linkedSignal,
  model,
  untracked,
} from '@angular/core';
import {
  FormField,
  ValidationError,
  applyEach,
  form,
  required,
  validate,
} from '@angular/forms/signals';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { QueryBuilderTermDefArg } from '../../query-builder';

const NUMERIC_REGEX = /^-?[0-9]+(?:\.[0-9]+)?$/;

interface QueryOpArgControls {
  // def is just to hold the arg's definition
  def: QueryBuilderTermDefArg;
  // value is the arg's value being effectively edited
  value: string;
}

interface QueryOpArgsControls {
  args: QueryOpArgControls[];
}

/**
 * Bound args -> draft. Each row gets fresh objects, so that the form's own
 * bookkeeping (it tags array items with a hidden identity Symbol) never
 * touches the caller's, often shared, definitions. The JSON round-trip,
 * unlike spreading, does not copy Symbol-keyed properties either.
 */
function toDraft(
  args: QueryBuilderTermDefArg[] | undefined | null,
): QueryOpArgsControls {
  return {
    args: (args || []).map((a) => ({
      def: JSON.parse(JSON.stringify(a)),
      value: a.value ?? '',
    })),
  };
}

/**
 * Draft -> args: only the args having a value are included.
 */
function toModel(draft: QueryOpArgsControls): QueryBuilderTermDefArg[] {
  return draft.args
    .filter((a) => a.value)
    .map((a) => ({ ...a.def, value: a.value }));
}

/**
 * Validate a non-empty arg value against its definition, like the numeric
 * pattern, min and max validators did: min/max are compared with the value
 * parsed as a number, and ignored when it is not a number.
 */
function validateArgValue(
  value: string,
  def: QueryBuilderTermDefArg,
): ValidationError[] {
  if (!value) {
    return [];
  }
  const errors: ValidationError[] = [];
  if (def.numeric && !NUMERIC_REGEX.test(value)) {
    errors.push({ kind: 'pattern' });
  }
  const n = parseFloat(value);
  if (def.min !== undefined && !isNaN(n) && n < +def.min) {
    errors.push({ kind: 'min' });
  }
  if (def.max !== undefined && !isNaN(n) && n > +def.max) {
    errors.push({ kind: 'max' });
  }
  return errors;
}

/**
 * Query operator arguments editor.
 */
@Component({
  selector: 'pythia-query-op-args',
  imports: [
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  templateUrl: './query-op-args.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./query-op-args.component.css'],
})
export class QueryOpArgsComponent {
  /**
   * The arguments definitions and their values. Values are edited
   * by this component.
   */
  public readonly args = model<QueryBuilderTermDefArg[] | undefined | null>();

  /**
   * The editable draft, derived from `args`. `previous` tells an external
   * change apart from the echo of our own save: `toModel()` drops the args
   * without a value, so without this check the echo would remove them from
   * the editor.
   */
  private readonly _draft = linkedSignal<
    QueryBuilderTermDefArg[] | undefined | null,
    QueryOpArgsControls
  >({
    source: () => this.args(),
    computation: (args, previous) =>
      previous &&
      JSON.stringify(args) === JSON.stringify(toModel(previous.value))
        ? previous.value
        : toDraft(args),
  });

  public readonly form = form(this._draft, (path) => {
    applyEach(path.args, (arg) => {
      required(arg.value, { when: ({ valueOf }) => !!valueOf(arg.def).required });
      validate(arg.value, ({ value, valueOf }) =>
        validateArgValue(value(), valueOf(arg.def)),
      );
    });
  });

  constructor() {
    // once the draft mirrors the bound args again there are no unsaved
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

  /** True when the draft still mirrors the bound args. */
  private isDraftInSync(draft: QueryOpArgsControls): boolean {
    return JSON.stringify(draft) === JSON.stringify(toDraft(this.args()));
  }

  /**
   * Enter in an arg saves, under the same condition which enabled the
   * save button (and thus the implicit form submission it replaces).
   */
  public onEnter(): void {
    if (!this.form().invalid() && this.form().dirty()) {
      this.save();
    }
  }

  public save(): void {
    if (this.form().invalid()) {
      this.form().markAsTouched();
      return;
    }
    this.args.set(toModel(this._draft()));
    this.form().reset();
  }
}
