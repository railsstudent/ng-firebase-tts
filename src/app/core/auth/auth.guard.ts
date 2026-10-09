import { AuthService } from '@/core/auth/auth.service';
import { APP_LINKS } from '@/core/constants/routes.const';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const canActivateDashboard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.ensureAuth();

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree([APP_LINKS.HOME]);
};
