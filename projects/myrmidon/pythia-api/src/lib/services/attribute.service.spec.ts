import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { DataPage } from '@myrmidon/ngx-tools';

import {
  API_URL,
  emptyPage,
  expectUrl,
  failRequests,
  setupHttpTestBed,
} from '../testing/http-test-helpers';
import { AttributeFilterType, AttributeService } from './attribute.service';

describe('AttributeService', () => {
  let service: AttributeService;
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttpTestBed();
    service = TestBed.inject(AttributeService);
  });

  afterEach(() => http.verify());

  it('should get attribute names with paging and type', () => {
    const page: DataPage<string> = {
      items: ['author', 'title'],
      pageNumber: 1,
      pageSize: 0,
      pageCount: 1,
      total: 2,
    };
    let result: DataPage<string> | undefined;
    service
      .getAttributeNames({
        pageNumber: 1,
        pageSize: 0,
        type: AttributeFilterType.Structure,
      })
      .subscribe((p) => (result = p));

    const req = expectUrl(http, API_URL + 'attributes');
    expect(req.request.params.get('pageNumber')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('0');
    expect(req.request.params.get('type')).toBe('1');
    expect(req.request.params.has('name')).toBe(false);
    req.flush(page);
    expect(result).toEqual(page);
  });

  it('should add name when specified', () => {
    service
      .getAttributeNames({
        pageNumber: 2,
        pageSize: 10,
        type: AttributeFilterType.Document,
        name: 'auth',
      })
      .subscribe();
    const req = expectUrl(http, API_URL + 'attributes');
    expect(req.request.params.get('type')).toBe('0');
    expect(req.request.params.get('name')).toBe('auth');
    req.flush(emptyPage(2, 10));
  });

  it('should retry 3 times and then emit an error message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let error: unknown;
    service
      .getAttributeNames({
        pageNumber: 1,
        pageSize: 10,
        type: AttributeFilterType.Occurrence,
      })
      .subscribe({ error: (e) => (error = e) });
    failRequests(http, API_URL + 'attributes', 4);
    expect(error).toBe('Server error: boom');
  });
});
