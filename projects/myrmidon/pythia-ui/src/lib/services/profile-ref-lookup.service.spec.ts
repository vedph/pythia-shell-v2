import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProfileService } from '@myrmidon/pythia-api';
import { Profile } from '@myrmidon/pythia-core';

import { ProfileRefLookupService } from './profile-ref-lookup.service';

describe('ProfileRefLookupService', () => {
  let service: ProfileRefLookupService;
  let profileService: {
    getProfile: ReturnType<typeof vi.fn>;
    getProfiles: ReturnType<typeof vi.fn>;
  };

  const profiles: Profile[] = [{ id: 'xml-tei' }, { id: 'txt' }];

  beforeEach(() => {
    profileService = {
      getProfile: vi.fn().mockReturnValue(of(profiles[0])),
      getProfiles: vi.fn().mockReturnValue(
        of({ items: profiles, pageNumber: 1, pageSize: 10, pageCount: 1, total: 2 }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: ProfileService, useValue: profileService }],
    });
    service = TestBed.inject(ProfileRefLookupService);
  });

  it('should have profile ID', () => {
    expect(service.id).toBe('profile');
  });

  it('should get by ID', () => {
    let result: unknown;
    service.getById('xml-tei').subscribe((p) => (result = p));
    expect(profileService.getProfile).toHaveBeenCalledWith('xml-tei');
    expect(result).toEqual(profiles[0]);
  });

  it('should look up by any portion of the ID, returning the page items', () => {
    let result: Profile[] = [];
    service.lookup({ text: 'x', limit: 10 }).subscribe((r) => (result = r));
    expect(profileService.getProfiles).toHaveBeenCalledWith({ id: 'x' }, 1, 10);
    expect(result).toEqual(profiles);
  });

  it('should get the ID as name', () => {
    expect(service.getName(profiles[1])).toBe('txt');
  });
});
