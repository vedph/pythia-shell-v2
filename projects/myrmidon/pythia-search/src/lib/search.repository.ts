import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject, tap, map } from 'rxjs';

import { DataPage } from '@myrmidon/ngx-tools';
import { KwicSearchResult, SearchService } from '@myrmidon/pythia-api';
import { DocumentReadRequest } from '@myrmidon/pythia-core';
import {
  PagedListStore,
  PagedListStoreService,
} from '@myrmidon/paged-data-browsers';

export interface KwicSearchFilter {
  query?: string;
  contextSize?: number; // default is 5
}

/**
 * A KWIC search result with a client-side key, used to track it in lists.
 * The server data carry no field guaranteed to be unique, so each loaded
 * result gets a key unique within this application session.
 */
export interface KwicSearchResultItem extends KwicSearchResult {
  key: number;
}

// a counter rather than crypto.randomUUID(), which is available only in
// secure contexts (HTTPS or localhost)
let lastKey = 0;

@Injectable({ providedIn: 'root' })
export class SearchRepository
  implements PagedListStoreService<KwicSearchFilter, KwicSearchResultItem>
{
  private readonly _store: PagedListStore<
    KwicSearchFilter,
    KwicSearchResultItem
  >;
  private readonly _query$: BehaviorSubject<string | undefined>;
  private readonly _prevQuery$: BehaviorSubject<string | undefined>;
  private readonly _lastQueries$: BehaviorSubject<string[]>;
  private readonly _error$: BehaviorSubject<string | undefined>;
  private readonly _readRequest$: BehaviorSubject<
    DocumentReadRequest | undefined
  >;
  private readonly _loading$: BehaviorSubject<boolean>;

  public get query$(): Observable<string | undefined> {
    return this._query$.asObservable();
  }
  public get prevQuery$(): Observable<string | undefined> {
    return this._prevQuery$.asObservable();
  }
  public get lastQueries$(): Observable<string[]> {
    return this._lastQueries$.asObservable();
  }
  public get page$(): Observable<DataPage<KwicSearchResultItem> | undefined> {
    return this._store.page$;
  }
  public get error$(): Observable<string | undefined> {
    return this._error$.asObservable();
  }
  public get readRequest$(): Observable<DocumentReadRequest | undefined> {
    return this._readRequest$.asObservable();
  }
  public get loading$(): Observable<boolean> {
    return this._loading$.asObservable();
  }

  constructor(private _searchService: SearchService) {
    this._store = new PagedListStore<any, KwicSearchResultItem>(this);
    this._query$ = new BehaviorSubject<string | undefined>(undefined);
    this._prevQuery$ = new BehaviorSubject<string | undefined>(undefined);
    this._lastQueries$ = new BehaviorSubject<string[]>([]);
    this._error$ = new BehaviorSubject<string | undefined>(undefined);
    this._readRequest$ = new BehaviorSubject<DocumentReadRequest | undefined>(
      undefined
    );
    this._loading$ = new BehaviorSubject<boolean>(false);
  }

  public loadPage(
    pageNumber: number,
    pageSize: number,
    filter: KwicSearchFilter
  ): Observable<DataPage<KwicSearchResultItem>> {
    if (!filter.contextSize) {
      filter.contextSize = 5;
    }
    let query = filter.query;
    if (!query) {
      query = this._prevQuery$.value;
      if (!query) {
        console.warn('No query');
        return of({
          items: [],
          pageNumber: 1,
          pageSize: 0,
          pageCount: 0,
          total: 0,
        } as DataPage<KwicSearchResultItem>);
      }
    }

    // load page from server
    this._loading$.next(true);
    this._error$.next(undefined);
    return this._searchService
      .search(query, filter.contextSize, pageNumber, pageSize)
      .pipe(
        tap({
          next: () => this._loading$.next(false),
          // e.g. network or server errors (syntax errors are in the result)
          error: (error) => {
            this._loading$.next(false);
            this._error$.next(
              typeof error === 'string' ? error : $localize`Search failed`,
            );
          },
        }),
        map((r) => {
          this._query$.next(query);
          this._prevQuery$.next(query);
          if (r.error) {
            this._error$.next(r.error);
            return {
              items: [],
              pageNumber: 1,
              pageSize: 0,
              pageCount: 0,
              total: 0,
            } as DataPage<KwicSearchResultItem>;
          } else {
            return {
              ...r.value!,
              items: r.value!.items.map((i) => ({ ...i, key: ++lastKey })),
            };
          }
        })
      );
  }

  public reset(): void {
    this._store.reset();
  }

  public clear(): void {
    this._store.clear();
    this._prevQuery$.next(this._query$.value);
    this._query$.next(undefined);
    this._readRequest$.next(undefined);
    this._error$.next(undefined);
  }

  public setFilter(filter: KwicSearchFilter): void {
    this._store.setFilter(filter).catch(() => {
      // error already notified via error$
    });
  }

  public setPage(pageNumber: number, pageSize: number): void {
    // cached pages are keyed by number and filter only, so they are stale
    // when the page size changes
    if (pageSize !== this._store.pageSize) {
      this._store.clearCache();
    }
    this._store.setPage(pageNumber, pageSize).catch(() => {
      // error already notified via error$
    });
  }

  public addToHistory(query: string): void {
    const queries = [...this._lastQueries$.value];
    if (queries.indexOf(query) > -1) {
      return;
    }
    queries.splice(0, 0, query);
    this._lastQueries$.next(queries);
  }

  public setReadRequest(request: DocumentReadRequest | undefined): void {
    this._readRequest$.next(request);
  }
}
