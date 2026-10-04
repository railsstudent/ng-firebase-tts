import { inject, provideEnvironmentInitializer } from '@angular/core';
import { Routes } from '@angular/router';
import { ConfigService } from './core/services/config.service';
import { HomeComponent } from './features/home/home.component';

const ROUTE_PATHS = {
  HOME: 'home',
  DASHBOARD: 'dashboard',
} as const;

export type RouteKey = keyof typeof ROUTE_PATHS;

export type AppRoute = `/${(typeof ROUTE_PATHS)[RouteKey]}`;

export const APP_LINKS: Record<RouteKey, AppRoute> = {
  HOME: `/${ROUTE_PATHS.HOME}`,
  DASHBOARD: `/${ROUTE_PATHS.DASHBOARD}`,
};

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
