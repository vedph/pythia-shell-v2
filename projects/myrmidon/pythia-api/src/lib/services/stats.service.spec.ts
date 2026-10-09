import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';

import {
  API_URL,
  expectUrl,
  failRequests,
  setupHttpTestBed,
} from '../testing/http-test-helpers';
import { StatsService } from './stats.service';

describe('StatsService', () => {
  let service: StatsService;
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttpTestBed();
    service = TestBed.inject(StatsService);
  });

  afterEach(() => http.verify());

  it('should get statistics', () => {
    let result: { [key: string]: number } | undefined;
    service.getStatistics().subscribe((s) => (result = s));
    expectUrl(http, API_URL + 'stats').flush({ word_count: 10 });
    expect(result).toEqual({ word_count: 10 });
  });

  it('should emit an error message after retrying', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let error: unknown;
    service.getStatistics().subscribe({ error: (e) => (error = e) });
    failRequests(http, API_URL + 'stats', 4);
    expect(error).toBe('Server error: boom');
  });
});
