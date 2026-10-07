import { APP_LINKS } from '@/core/constants/routes.const';
import { AuthService } from '@/core/services/auth.service';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const canActivateDashboard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree([APP_LINKS.HOME]);
};
