import { canActivateDashboard } from './auth.guard';
import { AuthService } from './auth.service';
import { APP_LINKS } from '@/core/constants/routes.const';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';

describe('canActivateDashboard', () => {
  let isAuthenticatedSignal: ReturnType<typeof signal<boolean>>;
  let mockAuthService: {
    ensureAuth: ReturnType<typeof vi.fn>;
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
      ensureAuth: vi.fn().mockResolvedValue({}),
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

  it('should call ensureAuth before checking authentication', async () => {
    isAuthenticatedSignal.set(true);

    const result = await TestBed.runInInjectionContext(() => canActivateDashboard(mockRoute, mockState));

    expect(mockAuthService.ensureAuth).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('should allow navigation when authenticated', async () => {
    isAuthenticatedSignal.set(true);

    const result = await TestBed.runInInjectionContext(() => canActivateDashboard(mockRoute, mockState));

    expect(result).toBe(true);
    expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
  });

  it('should return home UrlTree when unauthenticated', async () => {
    isAuthenticatedSignal.set(false);

    const result = await TestBed.runInInjectionContext(() => canActivateDashboard(mockRoute, mockState));

    expect(mockRouter.createUrlTree).toHaveBeenCalledWith([APP_LINKS.HOME]);
    expect(result).toBe(mockUrlTree);
  });
});
