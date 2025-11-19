import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';

import {
  ErrorService,
  EnvService,
  DataPage,
  ErrorWrapper,
} from '@myrmidon/ngx-tools';

/**
 * Search result interface.
 */
export interface SearchResult {
  id: string;
  documentId: number;
  p1: number;
  p2: number;
  index: number;
  length: number;
  type: string;
  value: string;
  author: string;
  title: string;
  sortKey: string;
}

/**
 * KWIC (Key Word In Context) search result interface.
 */
export interface KwicSearchResult extends SearchResult {
  text: string;
  leftContext: string[];
  rightContext: string[];
}

/**
 * Service to perform searches.
 */
@Injectable({
  providedIn: 'root',
})
export class SearchService {
  constructor(
    private _http: HttpClient,
    private _error: ErrorService,
    private _env: EnvService
  ) {}

  /**
   * Performs a search.
   *
   * @param query The query.
   * @param contextSize The context size.
   * @param pageNumber The page number.
   * @param pageSize The page size.
   * @param sortFields The sort fields.
   * @returns Observable with ResultWrapper and a page of results, or
   * an error message in case of syntax errors.
   */
  public search(
    query: string,
    contextSize = 5,
    pageNumber = 1,
    pageSize = 20,
    sortFields?: string[]
  ): Observable<ErrorWrapper<DataPage<KwicSearchResult>>> {
    // empty result set for invalid search parameters
    if (pageNumber < 1 || pageSize < 1 || !query) {
      const w: ErrorWrapper<DataPage<KwicSearchResult>> = {
        value: {
          items: [],
          pageNumber: pageNumber,
          pageSize: pageSize,
          pageCount: 0,
          total: 0,
        },
      };
      return of(w);
    }

    // set parameters
    let params = new HttpParams()
      .set('query', query)
      .set('contextSize', contextSize.toString())
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    // add fields to parameters if specified
    if (sortFields?.length) {
      params = params.set('sort', sortFields.join(','));
    }

    return this._http
      .get<ErrorWrapper<DataPage<KwicSearchResult>>>(
        this._env.get('apiUrl') + 'search',
        {
          params: params,
        }
      )
      .pipe(retry(3), catchError(this._error.handleError));
  }

  /**
   * Export search results to CSV.
   *
   * @param query The search query.
   * @param pageSize The page size.
   * @param pageNumber The first page number.
   * @param lastPage The last page number, or nothing to export all pages
   * starting from the first one.
   * @param contextSize The context size.
   * @returns Observable.
   */
  public exportSearchResults(
    query: string,
    pageSize: number = 100,
    pageNumber: number = 1,
    lastPage?: number,
    contextSize: number = 5
  ): Observable<string> {
    let params = new HttpParams()
      .set('query', query)
      .set('pageSize', pageSize.toString())
      .set('pageNumber', pageNumber.toString())
      .set('contextSize', contextSize.toString());

    if (lastPage) {
      params = params.set('lastPage', lastPage.toString());
    }

    return this._http.get(this._env.get('apiUrl') + 'search/csv', {
      params: params,
      responseType: 'text',
      observe: 'body',
    });
  }
}
