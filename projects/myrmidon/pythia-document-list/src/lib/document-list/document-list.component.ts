import {
  Component,
  EventEmitter,
  input,
  Input,
  output,
  Output,
} from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import '@angular/localize/init';
import { CommonModule } from '@angular/common';
import { Observable, take } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DataPage } from '@myrmidon/ngx-tools';
import { Document, DocumentReadRequest } from '@myrmidon/pythia-core';
import { CorpusService, DocumentFilter } from '@myrmidon/pythia-api';

import { DocumentRepository } from '../document.repository';
import {
  CorpusActionRequest,
  DocumentCorpusComponent,
} from '../document-corpus/document-corpus.component';
import {
  DocumentFilterComponent,
  DocumentFilters,
} from '../document-filter/document-filter.component';
import { DocumentInfoComponent } from '../document-info/document-info.component';

@Component({
  selector: 'pythia-document-list',
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTooltipModule,
    DocumentFilterComponent,
    DocumentInfoComponent,
    DocumentCorpusComponent,
  ],
  templateUrl: './document-list.component.html',
  styleUrls: ['./document-list.component.css'],
  providers: [DocumentRepository],
})
export class DocumentListComponent {
  public loading$: Observable<boolean>;
  public activeDocument$: Observable<Document | undefined>;
  public filter$: Observable<Readonly<DocumentFilter>>;
  public page$: Observable<Readonly<DataPage<Document>>>;

  /**
   * The list of document filters to be hidden.
   */
  public readonly hiddenFilters = input<DocumentFilters | undefined>();

  /**
   * Emitted when a document is requested to be read.
   */
  public readonly readRequest = output<DocumentReadRequest>();

  constructor(
    private _repository: DocumentRepository,
    private _snackbar: MatSnackBar,
    private _corpusService: CorpusService
  ) {
    this.loading$ = _repository.loading$;
    this.activeDocument$ = _repository.activeDocument$;
    this.filter$ = _repository.filter$;
    this.page$ = _repository.page$;
  }

  public onFilterChange(filter?: DocumentFilter | null): void {
    this._repository.setFilter(filter || {});
  }

  public onPageChange(event: PageEvent): void {
    this._repository.setPage(event.pageIndex + 1, event.pageSize);
  }

  public selectDocument(document: Document): void {
    this._repository.setActiveDocument(document.id);
  }

  public onDocumentClose(): void {
    this._repository.setActiveDocument(null);
  }

  public requestRead(document: Document): void {
    this.readRequest.emit({ documentId: document.id });
  }

  private isEmptyFilter(filter: DocumentFilter): boolean {
    return (
      !filter.corpusId &&
      !filter.author &&
      !filter.title &&
      !filter.source &&
      !filter.profileId &&
      !filter.minDateValue &&
      !filter.maxDateValue &&
      !filter.minTimeModified &&
      !filter.maxTimeModified &&
      !filter.attributes?.length
    );
  }

  public onCorpusAction(request: CorpusActionRequest): void {
    const filter = this._repository.getFilter();
    if (this.isEmptyFilter(filter)) {
      this._snackbar.open($localize`No filter applied`, 'OK', {
        duration: 3000,
      });
      return;
    }
    switch (request.action) {
      case 'add-filtered':
        this._corpusService
          .addDocumentsByFilter(request.corpusId, filter)
          .pipe(take(1))
          .subscribe({
            next: (_) => {
              this._snackbar.open($localize`Corpus updated`, 'OK', {
                duration: 2000,
              });
            },
            error: (error) => {
              console.error($localize`Error adding documents by filter`);
              if (error) {
                console.error(JSON.stringify(error));
              }
              this._snackbar.open($localize`Error updating corpus`, 'OK');
            },
          });
        break;
      case 'del-filtered':
        this._corpusService
          .removeDocumentsByFilter(request.corpusId, filter)
          .pipe(take(1))
          .subscribe({
            next: (_) => {
              this._snackbar.open($localize`Corpus updated`, 'OK', {
                duration: 2000,
              });
            },
            error: (error) => {
              console.error($localize`Error removing documents by filter`);
              if (error) {
                console.error(JSON.stringify(error));
              }
              this._snackbar.open($localize`Error updating corpus`, 'OK');
            },
          });
        break;
    }
  }

  public refresh(): void {
    this._repository.reset();
  }
}
