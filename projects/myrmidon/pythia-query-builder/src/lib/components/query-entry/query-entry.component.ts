import {
  Component,
  effect,
  input,
  model,
  OnDestroy,
  OnInit,
  output,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { distinctUntilChanged, Subscription } from 'rxjs';

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
 * Query entry editor component. This edits a clause or just a logical term
 * like logical operators or brackets.
 */
@Component({
  selector: 'pythia-query-entry',
  imports: [
    ReactiveFormsModule,
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
  styleUrls: ['./query-entry.component.css'],
})
export class QueryEntryComponent implements OnInit, OnDestroy {
  private readonly _subs: Subscription[];
  private _entry?: QueryBuilderEntry;
  // clause form
  public attribute: FormControl<QueryBuilderTermDef | null>;
  public operator: FormControl<QueryBuilderTermDef | null>;
  public value: FormControl<string>;
  public pairArgs: FormControl<QueryBuilderTermDefArg[] | null>;
  public pairForm: FormGroup;
  // outer form
  public type: FormControl<QueryBuilderTermDef>;
  public args: FormControl<QueryBuilderTermDefArg[] | null>;
  public form: FormGroup;

  /**
   * Types of entry. Text-specific types are optionally added during init.
   */
  public entryTypes = [
    {
      value: '-',
      label: $localize`pair`,
      group: '',
    },
    ...QUERY_OP_DEFS,
  ];

  public opGroups: GroupedQueryBuilderTermDefs;
  public attrGroups: GroupedQueryBuilderTermDefs;

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

  constructor(formBuilder: FormBuilder) {
    this._subs = [];
    this.opGroups = this.groupByKey(
      QUERY_PAIR_OP_DEFS.filter((d) => !d.hidden),
      'group'
    ) as GroupedQueryBuilderTermDefs;
    this.attrGroups = {};
    // pair form
    this.attribute = formBuilder.control(null, Validators.required);
    this.operator = formBuilder.control(null, Validators.required);
    this.value = formBuilder.control('', {
      validators: [Validators.required, Validators.maxLength(100)],
      nonNullable: true,
    });
    this.pairArgs = formBuilder.control(null);
    this.pairForm = formBuilder.group({
      attribute: this.attribute,
      operator: this.operator,
      value: this.value,
      pairArgs: this.pairArgs,
    });

    // main form
    this.type = formBuilder.control(this.entryTypes[0], { nonNullable: true });
    this.args = formBuilder.control(null);
    this.form = formBuilder.group({
      type: this.type,
      args: this.args,
      clause: this.pairForm,
    });

    effect(() => {
      this.attrGroups = this.groupByKey(
        this.attrDefinitions().filter((d) => !d.hidden),
        'group'
      );
    });

    effect(() => {
      this.updateForm(this.entry() || undefined);
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

  public ngOnInit(): void {
    // configure according to target
    if (!this.isDocument()) {
      // if not a document, add location operators
      this.entryTypes = [...this.entryTypes, ...QUERY_LOCATION_OP_DEFS].filter(
        (d) => !d.hidden && d.type !== QueryBuilderTermType.Document
      );
    }

    // when type changes, enable or disable pair form and setup type args
    this._subs.push(
      this.type.valueChanges.pipe(distinctUntilChanged()).subscribe((def) => {
        if (def.value === '-') {
          this.pairForm.enable();
        } else {
          this.pairForm.disable();
          this.args.setValue(def.args || []);
        }
      })
    );

    // when operator changes, setup type args
    this._subs.push(
      this.operator.valueChanges
        .pipe(distinctUntilChanged())
        .subscribe((def) => {
          if (def) {
            this.pairArgs.setValue(def.args || []);
          } else {
            this.pairArgs.setValue([]);
          }
        })
    );
  }

  public ngOnDestroy(): void {
    this._subs.forEach((s) => s.unsubscribe());
  }

  private updateForm(entry?: QueryBuilderEntry): void {
    if (!entry) {
      this.form.reset();
      return;
    }
    // set entry type
    this.type.setValue(
      entry.pair
        ? this.entryTypes[0]
        : this.entryTypes.find((t) => t.value === entry.operator?.value) ||
            this.entryTypes[0]
    );

    // set pair form
    setTimeout(() => {
      // if not a pair, reset pair and set op args if any
      if (!entry.pair) {
        this.pairForm.reset();
        if (entry.opArgs?.length) {
          this.args.setValue(entry.opArgs);
        }
      } else {
        // else set values from entry.pair
        const pair = entry.pair!;
        this.attribute.setValue(pair.attribute || null);
        this.operator.setValue(pair.operator || null);
        this.value.setValue(pair.value);
        if (pair.opArgs?.length) {
          this.pairArgs.setValue(pair.opArgs);
        } else {
          this.pairArgs.setValue(null);
        }
        this.pairForm.markAsPristine();
      }
      this.form.markAsPristine();
    });
  }

  public onArgsChange(args?: QueryBuilderTermDefArg[] | null): void {
    this.args.setValue(args || []);
    this.args.updateValueAndValidity();
    this.args.markAsDirty();
  }

  public onPairArgsChange(args?: QueryBuilderTermDefArg[] | null): void {
    this.pairArgs.setValue(args || []);
    this.pairArgs.updateValueAndValidity();
    this.pairArgs.markAsDirty();
  }

  private getEntry(): QueryBuilderEntry {
    if (this.type.value.value === '-') {
      return {
        pair: {
          attribute: this.attribute.value!,
          operator: this.operator.value!,
          opArgs: this.pairArgs.value || [],
          value: this.value.value,
        },
      };
    } else {
      return {
        operator: this.type.value as any,
        opArgs: this.args.value || [],
      };
    }
  }

  public close(): void {
    this.editorClose.emit();
  }

  public save(): void {
    if (this.form.invalid) {
      return;
    }
    this.entry.set(this.getEntry());
  }
}
