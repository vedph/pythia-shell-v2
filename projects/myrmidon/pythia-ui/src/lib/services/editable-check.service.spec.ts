import { TestBed } from '@angular/core/testing';
import { AuthJwtService } from '@myrmidon/auth-jwt-login';

import { EditableCheckService } from './editable-check.service';

describe('EditableCheckService', () => {
  let service: EditableCheckService;
  let auth: {
    currentUserValue: { userName: string } | null;
    isCurrentUserInRole: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    auth = {
      currentUserValue: { userName: 'zeus' },
      isCurrentUserInRole: vi.fn().mockReturnValue(false),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AuthJwtService, useValue: auth }],
    });
    service = TestBed.inject(EditableCheckService);
  });

  it('should not allow editing a null or undefined target', () => {
    expect(service.isEditable(null)).toBe(false);
    expect(service.isEditable(undefined)).toBe(false);
  });

  it('should not allow editing a target without user ID, even for admin', () => {
    auth.isCurrentUserInRole.mockReturnValue(true);
    expect(service.isEditable({})).toBe(false);
    expect(service.isEditable({ userId: '' })).toBe(false);
  });

  it('should allow editing a target owned by the current user', () => {
    expect(service.isEditable({ userId: 'zeus' })).toBe(true);
  });

  it('should not allow editing a target owned by another user', () => {
    expect(service.isEditable({ userId: 'hera' })).toBe(false);
    expect(auth.isCurrentUserInRole).toHaveBeenCalledWith('admin');
  });

  it('should allow an admin to edit a target owned by another user', () => {
    auth.isCurrentUserInRole.mockReturnValue(true);
    expect(service.isEditable({ userId: 'hera' })).toBe(true);
  });

  it('should not allow editing when no user is logged in', () => {
    auth.currentUserValue = null;
    expect(service.isEditable({ userId: 'zeus' })).toBe(false);
  });
});
