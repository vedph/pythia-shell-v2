import { Component, input, OnDestroy, OnInit, output } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { combineLatest, Observable, Subscription } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  QueryBuilder,
  QueryBuilderEntry,
  QueryBuilderTermDef,
} from '../../query-builder';
import { QueryEntryComponent } from '../query-entry/query-entry.component';

export interface QueryEntrySet {
  entries: QueryBuilderEntry[];
  errors?: string[];
}

/**
 * Entries set editor component.
 */
@Component({
  selector: 'pythia-query-entry-set',
  imports: [
    AsyncPipe,
    MatButtonModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    QueryEntryComponent,
  ],
  templateUrl: './query-entry-set.component.html',
  styleUrls: ['./query-entry-set.component.css'],
})
export class QueryEntrySetComponent implements OnInit, OnDestroy {
  private readonly _builder: QueryBuilder;
  private _sub?: Subscription;
  private _editedInsertIndex: number;

  public TYPES = ['clause', 'AND', 'OR', 'AND NOT', '(', ')'];
  public editedIndex: number;
  public editedEntry?: QueryBuilderEntry;
  public entries$: Observable<QueryBuilderEntry[]>;
  public errors$: Observable<string[]>;

  /**
   * True if the set refers to a document query. This is meant to be set
   * only once.
   */
  public readonly isDocument = input<boolean | undefined>();

  /**
   * The attributes definitions to use. This is meant to be set only once.
   */
  public readonly attrDefinitions = input<QueryBuilderTermDef[]>([]);

  /**
   * The entries to edit.
   */
  public readonly entries = input<QueryBuilderEntry[]>([]);

  /**
   * Emitted when the entries set is changed.
   */
  public entrySetChange = output<QueryEntrySet>();

  constructor() {
    this._builder = new QueryBuilder();
    this.editedIndex = -1;
    this._editedInsertIndex = -1;
    this.entries$ = this._builder.selectEntries();
    this.errors$ = this._builder.selectErrors();
  }

  public ngOnInit(): void {
    this._sub = combineLatest({
      entries: this.entries$,
      errors: this.errors$,
    }).subscribe((ee) => {
      this.entrySetChange.emit({
        entries: ee.entries,
        errors: ee.errors,
      });
    });

    // ensure that observables are emitted so combineLatest is happy
    this._builder.forDocument(this.isDocument());
    this._builder.reset();
  }

  public ngOnDestroy(): void {
    this._sub?.unsubscribe();
  }

  public addEntry(insertAt?: number): void {
    this._editedInsertIndex = insertAt !== undefined ? insertAt : -1;
    this.editEntry({}, -1);
  }

  public editEntry(entry: QueryBuilderEntry, index: number): void {
    this.editedEntry = entry;
    this.editedIndex = index;
  }

  public saveEntry(entry?: QueryBuilderEntry | null): void {
    if (!entry) {
      return;
    }
    if (this._editedInsertIndex > -1) {
      // insert
      this._builder.addEntry(entry, this._editedInsertIndex, true);
    } else {
      // append or replace
      this._builder.addEntry(entry, this.editedIndex);
    }
    this.closeEntry();
  }

  public closeEntry(): void {
    this.editedEntry = undefined;
    this.editedIndex = -1;
    this._editedInsertIndex = -1;
  }

  public deleteEntry(index: number): void {
    this._builder.deleteEntry(index);
  }

  public moveEntryUp(index: number): void {
    this._builder.moveEntryUp(index);
  }

  public moveEntryDown(index: number): void {
    this._builder.moveEntryDown(index);
  }

  public reset(): void {
    this._builder.reset();
  }
}
