import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Profile } from '@myrmidon/pythia-core';

import {
  API_URL,
  emptyPage,
  expectUrl,
  failRequests,
  setupHttpTestBed,
} from '../testing/http-test-helpers';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttpTestBed();
    service = TestBed.inject(ProfileService);
  });

  afterEach(() => http.verify());

  it('should get profiles with default paging and no filter', () => {
    service.getProfiles({}).subscribe();
    const req = expectUrl(http, API_URL + 'profiles');
    expect(req.request.params.keys().sort()).toEqual([
      'pageNumber',
      'pageSize',
    ]);
    expect(req.request.params.get('pageNumber')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush(emptyPage());
  });

  it('should pass all filter params', () => {
    const profiles: Profile[] = [{ id: 'p1' }];
    let items: Profile[] = [];
    service
      .getProfiles({ id: 'p', prefix: 'pre', type: 't', userId: 'u' }, 2, 0, true)
      .subscribe((p) => (items = p.items));
    const req = expectUrl(http, API_URL + 'profiles');
    const p = req.request.params;
    expect(p.get('pageNumber')).toBe('2');
    expect(p.get('pageSize')).toBe('0');
    expect(p.get('id')).toBe('p');
    expect(p.get('prefix')).toBe('pre');
    expect(p.get('type')).toBe('t');
    expect(p.get('userId')).toBe('u');
    expect(p.get('noContent')).toBe('true');
    req.flush({
      items: profiles,
      pageNumber: 2,
      pageSize: 0,
      pageCount: 1,
      total: 1,
    });
    expect(items).toEqual(profiles);
  });

  it('should get a profile by ID', () => {
    let result: Profile | undefined;
    service.getProfile('p1').subscribe((p) => (result = p));
    expectUrl(http, API_URL + 'profiles/p1').flush({ id: 'p1', content: '{}' });
    expect(result).toEqual({ id: 'p1', content: '{}' });
  });

  it('should emit an error message after retrying', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let error: unknown;
    service.getProfile('x').subscribe({ error: (e) => (error = e) });
    failRequests(http, API_URL + 'profiles/x', 4);
    expect(error).toBe('Server error: boom');
  });
});
