import { inject, provideEnvironmentInitializer } from '@angular/core';
import type { Routes } from '@angular/router';
import { canActivateDashboard } from './core/auth/auth.guard';
import { ROUTE_PATHS } from './core/constants/routes.const';
import { ConfigService } from './core/firebase/config.service';
import { HomeComponent } from './features/home/home.component';

export const routes: Routes = [
  {
    path: ROUTE_PATHS.HOME,
    title: 'Home',
    component: HomeComponent,
  },
  {
    path: ROUTE_PATHS.DASHBOARD,
    title: 'Firebase TTS',
    providers: [provideEnvironmentInitializer(() => inject(ConfigService).initialize())],
    loadComponent: () => import('./features/dashboard/dashboard.component'),
    canActivate: [canActivateDashboard],
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: ROUTE_PATHS.HOME,
  },
  {
    path: '**',
    redirectTo: ROUTE_PATHS.HOME,
  },
];
