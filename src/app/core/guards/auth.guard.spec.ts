import { APP_LINKS } from '@/core/constants/routes.const';
import { canActivateDashboard } from '@/core/guards/auth.guard';
import { AuthService } from '@/core/services/auth.service';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

describe('canActivateDashboard', () => {
  let isAuthenticatedSignal: ReturnType<typeof signal<boolean>>;
  let mockAuthService: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
  };
  let mockRouter: {
    createUrlTree: ReturnType<typeof vi.fn>;
  };
  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = { url: '/dashboard' } as RouterStateSnapshot;
  const mockUrlTree = {} as UrlTree;

  beforeEach(() => {
    isAuthenticatedSignal = signal<boolean>(false);
    mockAuthService = {
      isAuthenticated: isAuthenticatedSignal,
    };
    mockRouter = {
      createUrlTree: vi.fn().mockReturnValue(mockUrlTree),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  it('should allow navigation when authenticated', () => {
    isAuthenticatedSignal.set(true);

    const result = TestBed.runInInjectionContext(() => canActivateDashboard(mockRoute, mockState));

    expect(result).toBe(true);
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('should return home UrlTree when unauthenticated', () => {
    isAuthenticatedSignal.set(false);

    const result = TestBed.runInInjectionContext(() => canActivateDashboard(mockRoute, mockState));

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([APP_LINKS.HOME]);
    expect(result).toBe(mockUrlTree);
  });
});
