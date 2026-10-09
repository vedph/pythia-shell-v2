import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  linkedSignal,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  FormField,
  applyWhen,
  form,
  maxLength,
  required,
} from '@angular/forms/signals';

import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';

import {
  QueryBuilderEntry,
  QueryBuilderTermDef,
  QueryBuilderTermDefArg,
  QueryBuilderTermType,
  QUERY_LOCATION_OP_DEFS,
  QUERY_OP_DEFS,
  QUERY_PAIR_OP_DEFS,
} from '../../query-builder';
import { QueryOpArgsComponent } from '../query-op-args/query-op-args.component';
import { KeyValuePipe } from '@angular/common';

/**
 * Used only in this component to group definitions.
 */
interface GroupedQueryBuilderTermDefs {
  [key: string]: QueryBuilderTermDef[];
}

/**
 * The pseudo-type of entry representing a pair (clause).
 */
const PAIR_TYPE: QueryBuilderTermDef = {
  value: '-',
  label: $localize`pair`,
  group: '',
};

interface QueryPairControls {
  attribute: QueryBuilderTermDef | null;
  operator: QueryBuilderTermDef | null;
  value: string;
  pairArgs: QueryBuilderTermDefArg[] | null;
}

interface QueryEntryControls {
  type: QueryBuilderTermDef;
  args: QueryBuilderTermDefArg[] | null;
  clause: QueryPairControls;
}

/**
 * Deep-copy a plain JSON value.
 *
 * Definitions and their args must never enter the form as they are: a form
 * tags the object items of the arrays in its value with a hidden identity
 * Symbol (measured: even the items of an array nested in an object field,
 * like a definition's `args`), and here they are shared constants. So the
 * option lists and the draft only hold copies, and the model gets a fresh
 * copy too, so that no tag leaks out. A JSON round-trip, unlike spreading,
 * does not copy Symbol-keyed properties.
 */
function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Compare definitions by value, as the draft holds copies of them.
 */
function compareDefs(
  a: QueryBuilderTermDef | null,
  b: QueryBuilderTermDef | null,
): boolean {
  return a?.value === b?.value;
}

function makeEmptyPair(): QueryPairControls {
  return { attribute: null, operator: null, value: '', pairArgs: null };
}

/**
 * Bound entry -> draft.
 * @param entry The entry.
 * @param types The available entry types, the first being the pair.
 */
function toDraft(
  entry: QueryBuilderEntry | undefined | null,
  types: QueryBuilderTermDef[],
): QueryEntryControls {
  const pairType = types[0];
  if (!entry) {
    return { type: pairType, args: null, clause: makeEmptyPair() };
  }
  if (entry.pair) {
    const pair = entry.pair;
    return {
      type: pairType,
      args: null,
      clause: {
        attribute: pair.attribute ? cloneJson(pair.attribute) : null,
        operator: pair.operator ? cloneJson(pair.operator) : null,
        value: pair.value,
        pairArgs: pair.opArgs?.length ? cloneJson(pair.opArgs) : null,
      },
    };
  }
  const type =
    types.find((t) => t.value === entry.operator?.value) || pairType;
  return {
    type,
    args:
      type.value === '-'
        ? null
        : cloneJson(entry.opArgs?.length ? entry.opArgs : type.args || []),
    clause: makeEmptyPair(),
  };
}

/**
 * Draft -> entry, as a fresh copy (see cloneJson).
 */
function toModel(draft: QueryEntryControls): QueryBuilderEntry {
  if (draft.type.value === '-') {
    const clause = draft.clause;
    return cloneJson({
      pair: {
        attribute: clause.attribute!,
        operator: clause.operator!,
        opArgs: clause.pairArgs || [],
        value: clause.value,
      },
    });
  }
  return cloneJson({
    operator: draft.type,
    opArgs: draft.args || [],
  });
}

/**
 * Query entry editor component. This edits a clause or just a logical term
 * like logical operators or brackets.
 */
@Component({
  selector: 'pythia-query-entry',
  imports: [
    FormField,
    KeyValuePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    QueryOpArgsComponent,
  ],
  templateUrl: './query-entry.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./query-entry.component.css'],
})
export class QueryEntryComponent {
  /**
   * True if this entry editor should target a document rather than text.
   * This property is meant to set only once.
   */
  public readonly isDocument = input<boolean | undefined>();

  /**
   * The attributes definitions to use. This is meant to be set only once.
   */
  public readonly attrDefinitions = input<QueryBuilderTermDef[]>([]);

  /**
   * The entry being edited.
   */
  public readonly entry = model<QueryBuilderEntry | undefined | null>();

  /**
   * Emitted when the user requests to close the editor.
   */
  public readonly editorClose = output();

  /**
   * Types of entry: the pair, followed by operators; when not targeting
   * a document, location operators are added.
   */
  public readonly entryTypes = computed<QueryBuilderTermDef[]>(() => {
    const types = [PAIR_TYPE, ...QUERY_OP_DEFS];
    return cloneJson(
      this.isDocument()
        ? types
        : [...types, ...QUERY_LOCATION_OP_DEFS].filter(
            (d) => !d.hidden && d.type !== QueryBuilderTermType.Document,
          ),
    );
  });

  public readonly compareDefs = compareDefs;

  public readonly opGroups = signal<GroupedQueryBuilderTermDefs | undefined>(
    undefined,
  );
  public readonly attrGroups = signal<GroupedQueryBuilderTermDefs>({});

  /**
   * The editable draft, derived from `entry`. `previous` tells an external
   * change apart from the echo of our own save, which would otherwise
   * rebuild the draft.
   */
  private readonly _draft = linkedSignal<
    {
      entry: QueryBuilderEntry | undefined | null;
      types: QueryBuilderTermDef[];
    },
    QueryEntryControls
  >({
    source: () => ({ entry: this.entry(), types: this.entryTypes() }),
    computation: ({ entry, types }, previous) =>
      previous &&
      types === previous.source.types &&
      JSON.stringify(entry) === JSON.stringify(toModel(previous.value))
        ? previous.value
        : toDraft(entry, types),
  });

  public readonly form = form(this._draft, (path) => {
    // the clause is validated only when editing a pair
    applyWhen(
      path.clause,
      ({ valueOf }) => valueOf(path.type).value === '-',
      (clause) => {
        required(clause.attribute);
        required(clause.operator);
        required(clause.value);
        maxLength(clause.value, 100);
      },
    );
  });

  constructor() {
    this.opGroups.set(
      this.groupByKey(
        cloneJson(QUERY_PAIR_OP_DEFS.filter((d) => !d.hidden)),
        'group',
      ) as GroupedQueryBuilderTermDefs,
    );

    effect(() => {
      this.attrGroups.set(
        this.groupByKey(
          cloneJson(this.attrDefinitions().filter((d) => !d.hidden)),
          'group',
        ),
      );
    });

    // once the draft mirrors the bound entry again there are no unsaved
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

  private groupByKey(array: Array<any>, key: string): { [key: string]: any[] } {
    // https://stackoverflow.com/questions/40774697/how-can-i-group-an-array-of-objects-by-key
    return array.reduce((hash, obj) => {
      if (obj[key] === undefined) return hash;
      return Object.assign(hash, {
        [obj[key]]: (hash[obj[key]] || []).concat(obj),
      });
    }, {});
  }

  /** True when the draft still mirrors the bound entry. */
  private isDraftInSync(draft: QueryEntryControls): boolean {
    return (
      JSON.stringify(draft) ===
      JSON.stringify(toDraft(this.entry(), this.entryTypes()))
    );
  }

  /**
   * When the user picks another type, setup its args.
   */
  public onTypeChange(def: QueryBuilderTermDef): void {
    if (def.value !== '-') {
      this.form.args().value.set(cloneJson(def.args || []));
    }
  }

  /**
   * When the user picks another operator, setup its args.
   */
  public onOperatorChange(def: QueryBuilderTermDef | null): void {
    this.form.clause.pairArgs().value.set(cloneJson(def?.args || []));
  }

  public onArgsChange(args?: QueryBuilderTermDefArg[] | null): void {
    this.form.args().value.set(cloneJson(args || []));
    this.form.args().markAsDirty();
  }

  public onPairArgsChange(args?: QueryBuilderTermDefArg[] | null): void {
    this.form.clause.pairArgs().value.set(cloneJson(args || []));
    this.form.clause.pairArgs().markAsDirty();
  }

  public close(): void {
    this.editorClose.emit();
  }

  public save(): void {
    if (this.form().invalid()) {
      this.form().markAsTouched();
      return;
    }
    this.entry.set(toModel(this._draft()));
    this.form().reset();
  }
}
