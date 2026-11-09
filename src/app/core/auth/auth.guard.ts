import { AuthService } from './auth.service';
import { APP_LINKS } from '@/core/constants/routes.const';
import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';

export const canActivateDashboard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  authService.ensureAuth().catch((error) => {
    console.error('Failed to restore auth session:', error);
  });

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree([APP_LINKS.HOME]);
};
