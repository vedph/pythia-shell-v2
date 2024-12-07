import { Component, ElementRef, input, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { DataPage } from '@myrmidon/ngx-tools';
import { DocumentReadRequest } from '@myrmidon/pythia-core';
import { KwicSearchResult } from '@myrmidon/pythia-api';
import { QueryBuilderComponent } from '@myrmidon/pythia-query-builder';
import { DocumentReaderComponent } from '@myrmidon/pythia-document-reader';

import { SearchRepository } from '../../search.repository';
import { SearchExportComponent } from '../search-export/search-export.component';

@Component({
  selector: 'pythia-search',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTabsModule,
    MatTooltipModule,
    QueryBuilderComponent,
    SearchExportComponent,
    DocumentReaderComponent,
  ],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css'],
})
export class SearchComponent implements OnInit {
  @ViewChild('queryCtl') queryElementRef: ElementRef | undefined;

  /**
   * Initial query term to be set in the search input.
   */
  public readonly initialQueryTerm = input<string | undefined>();

  /**
   * Whether to hide the author column.
   */
  public readonly hideAuthor = input<boolean | undefined>();

  /**
   * Whether to hide the title column.
   */
  public readonly hideTitle = input<boolean | undefined>();

  public query$: Observable<string | undefined>;
  public lastQueries$: Observable<string[]>;
  public loading$: Observable<boolean | undefined>;
  public page$: Observable<DataPage<KwicSearchResult> | undefined>;
  public error$: Observable<string | undefined>;
  public readRequest$: Observable<DocumentReadRequest | undefined>;

  public query: FormControl<string | null>;
  public history: FormControl<string | null>;
  public form: FormGroup;

  public leftContextLabels: string[];
  public rightContextLabels: string[];
  public queryTabIndex: number;

  constructor(private _repository: SearchRepository, formBuilder: FormBuilder) {
    this.query = formBuilder.control(null, [
      Validators.required,
      Validators.maxLength(1000),
    ]);
    this.history = formBuilder.control(null);
    this.form = formBuilder.group({
      query: this.query,
      history: this.history,
    });
    this.leftContextLabels = ['5', '4', '3', '2', '1'];
    this.rightContextLabels = ['1', '2', '3', '4', '5'];
    this.queryTabIndex = 0;

    this.page$ = _repository.page$;
    this.query$ = _repository.query$;
    this.lastQueries$ = _repository.lastQueries$;
    this.loading$ = _repository.loading$;
    this.error$ = _repository.error$;
    this.readRequest$ = _repository.readRequest$;
  }

  public ngOnInit(): void {
    const term = this.initialQueryTerm();
    if (term) {
      if (term.startsWith('^')) {
        this.query.setValue(`[lemma="${term.substring(1)}"]`);
      } else {
        this.query.setValue(`[value="${term}"]`);
      }
      setTimeout(() => this.search(), 0);
    }
  }

  public pageChange(event: PageEvent): void {
    this._repository.loadPage(event.pageIndex + 1, event.pageSize, {
      query: this.query.value!,
    });
  }

  public pickHistory(): void {
    if (!this.history.value) {
      return;
    }
    this.query.setValue(this.history.value);
    setTimeout(this.queryElementRef?.nativeElement.focus(), 0);
  }

  public search(): void {
    if (this.form.invalid) {
      return;
    }
    const query = this.query.value?.trim();
    if (!query) {
      return;
    }
    this._repository.addToHistory(query);
    this._repository.setFilter({ query });
  }

  public searchByEnter(event: KeyboardEvent): void {
    event.stopPropagation();
    this.search();
  }

  public onQueryPeek(query: string): void {
    this.query.setValue(query);
    setTimeout(() => {
      this.queryTabIndex = 0;
      this.queryElementRef?.nativeElement.focus();
    }, 0);
  }

  public onQueryChange(query: string): void {
    this.query.setValue(query);
    this._repository.addToHistory(query);
    this._repository.setFilter({ query });
  }

  public onPageChange(event: PageEvent): void {
    this._repository.setPage(event.pageIndex + 1, event.pageSize);
  }

  public readDocument(id: number) {
    this._repository.setReadRequest({
      documentId: id,
    });
  }

  public readDocumentPiece(id: number, start: number, length: number) {
    this._repository.setReadRequest({
      documentId: id,
      start: start,
      end: start + length,
    });
  }
}
