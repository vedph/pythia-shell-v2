import { Component, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { take } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';

import { DataPage, deepCopy } from '@myrmidon/ngx-tools';
import { DialogService } from '@myrmidon/ngx-mat-tools';
import { AuthJwtService } from '@myrmidon/auth-jwt-login';
import { PagedListStore } from '@myrmidon/paged-data-browsers';

import { Corpus } from '@myrmidon/pythia-core';
import { CorpusFilter, CorpusService } from '@myrmidon/pythia-api';
import { EditablePipe } from '@myrmidon/pythia-ui';

import { CorpusListBrowserService } from './corpus-list-browser.service';
import {
  CorpusEditorComponent,
  EditedCorpus,
} from '../corpus-editor/corpus-editor.component';
import { CorpusFilterComponent } from '../corpus-filter/corpus-filter.component';

/**
 * A list of corpora.
 */
@Component({
  selector: 'pythia-corpus-list',
  imports: [
    ReactiveFormsModule,
    AsyncPipe,
    EditablePipe,
    MatButtonModule,
    MatCardModule,
    MatExpansionModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTooltipModule,
    CorpusFilterComponent,
    CorpusEditorComponent,
  ],
  templateUrl: './corpus-list.component.html',
  styleUrls: ['./corpus-list.component.css'],
})
export class CorpusListComponent {
  private readonly _store: PagedListStore<CorpusFilter, Corpus>;

  public filter$: Observable<Readonly<CorpusFilter>>;
  public page$: Observable<Readonly<DataPage<Corpus>>>;

  public readonly loading = signal<boolean>(false);
  public readonly editedCorpus = signal<EditedCorpus | undefined>(undefined);
  public readonly admin = signal<boolean>(false);

  constructor(
    service: CorpusListBrowserService,
    private _corpusService: CorpusService,
    private _authService: AuthJwtService,
    private _dialogService: DialogService,
    private _snackbar: MatSnackBar
  ) {
    this._store = service.store;
    this.filter$ = this._store.filter$;
    this.page$ = this._store.page$;
    this.admin.set(_authService.isCurrentUserInRole('admin'));
  }

  public reset(): void {
    this.loading.set(true);
    this._store.reset();
    this._store
      .setFilter(
        this.admin()
          ? {}
          : { userId: this._authService.currentUserValue?.userName }
      )
      .finally(() => {
        this.loading.set(false);
      });
  }

  public ngOnInit(): void {
    if (this._store.isEmpty()) {
      this.reset();
    }
  }

  public onFilterChange(filter?: CorpusFilter | null): void {
    this.loading.set(true);
    if (!this.admin) {
      filter = {
        ...filter,
        userId: this._authService.currentUserValue?.userName,
      };
    }
    this._store.setFilter(filter || {}).finally(() => {
      this.loading.set(false);
    });
  }

  public onPageChange(event: PageEvent): void {
    this.loading.set(true);
    this._store.setPage(event.pageIndex + 1, event.pageSize).finally(() => {
      this.loading.set(false);
    });
  }

  public addCorpus(): void {
    if (!this._authService.currentUserValue) {
      return;
    }
    this.editedCorpus.set({
      id: '',
      title: 'corpus',
      description: '',
      userId: this._authService.currentUserValue?.userName!,
    });
  }

  public editCorpus(corpus: Corpus): void {
    if (!this._authService.currentUserValue) {
      return;
    }
    this.editedCorpus.set(deepCopy(corpus));
  }

  public deleteCorpus(corpus: Corpus): void {
    this._dialogService
      .confirm($localize`Confirm`, $localize`Delete corpus ${corpus.title}?`)
      .pipe(take(1))
      .subscribe((yes) => {
        if (!yes) {
          return;
        }

        this._corpusService.deleteCorpus(corpus.id).subscribe({
          next: () => {
            this.reset();
          },
          error: (err) => {
            console.error(err);
            this._snackbar.open('Error deleting corpus', 'OK');
          },
        });
      });
  }

  public onCorpusChange(corpus?: EditedCorpus | null): void {
    if (!corpus) {
      return;
    }
    this._corpusService.addCorpus(corpus, corpus.sourceId).subscribe({
      next: () => {
        this.reset();
      },
      error: (err) => {
        console.error(err);
        this._snackbar.open('Error saving corpus', 'OK');
      },
    });
    this.editedCorpus.set(undefined);
  }

  public onCorpusEditorClose(): void {
    this.editedCorpus.set(undefined);
  }
}
