import { Component, effect, model, output } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { QueryBuilderTermDefArg } from '../../query-builder';

/**
 * Query operator arguments editor.
 */
@Component({
  selector: 'pythia-query-op-args',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  templateUrl: './query-op-args.component.html',
  styleUrls: ['./query-op-args.component.css'],
})
export class QueryOpArgsComponent {
  public arguments: FormArray;
  public form: FormGroup;

  /**
   * The arguments definitions and their values. Values are edited
   * by this component.
   */
  public readonly args = model<QueryBuilderTermDefArg[] | undefined | null>();

  constructor(private _formBuilder: FormBuilder) {
    this.arguments = _formBuilder.array([]);
    this.form = _formBuilder.group({ arguments: this.arguments });

    effect(() => {
      this.updateForm(this.args() || undefined);
    });
  }

  private updateForm(args?: QueryBuilderTermDefArg[]): void {
    this.arguments.clear();

    if (!args?.length) {
      this.arguments.disable();
      return;
    }

    for (let i = 0; i < args.length; i++) {
      const validators = [];
      if (args[i].required) {
        validators.push(Validators.required);
      }
      if (args[i].numeric) {
        validators.push(Validators.pattern('-?[0-9]+(?:.[0-9]+)?'));
      }
      if (args[i].min) {
        validators.push(Validators.min(+args[i].min!));
      }
      if (args[i].max) {
        validators.push(Validators.max(+args[i].max!));
      }
      const g = this._formBuilder.group({
        // def is just to hold the arg's definition
        def: this._formBuilder.control<QueryBuilderTermDefArg>(args[i], {
          nonNullable: true,
        }),
        // value is the arg's value being effectively edited
        value: this._formBuilder.control<string | null>(
          args[i].value ?? null,
          validators,
        ),
      });
      this.arguments.push(g);
    }
    this.arguments.enable();

    this.form.markAsPristine();
  }

  private getArgs(): QueryBuilderTermDefArg[] {
    const args: QueryBuilderTermDefArg[] = [];

    for (let i = 0; i < this.arguments.length; i++) {
      const g = this.arguments.at(i) as FormGroup;
      const value = g.controls['value'].value as string;
      if (value) {
        const def = g.controls['def'].value as QueryBuilderTermDefArg;
        args.push({ ...def, value: value });
      }
    }

    return args;
  }

  public save(): void {
    this.args.set(this.getArgs());
    this.form.markAsPristine();
  }
}
