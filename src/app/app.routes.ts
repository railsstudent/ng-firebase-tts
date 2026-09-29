import { inject, provideEnvironmentInitializer } from '@angular/core';
import { Routes } from '@angular/router';
import { ConfigService } from './core/services/config.service';
import { HomeComponent } from './features/home/home.component';

export const ROUTE_PATHS = {
  HOME: 'home',
  DASHBOARD: 'dashboard',
} as const;

export type RouteKey = keyof typeof ROUTE_PATHS;

export type AppRoute = `/${(typeof ROUTE_PATHS)[RouteKey]}`;

export const APP_LINKS: Record<RouteKey, AppRoute> = {
  HOME: '/home',
  DASHBOARD: '/dashboard',
};

export const routes: Routes = [
  {
    path: 'home',
    title: 'Home',
    component: HomeComponent,
  },
  {
    path: 'dashboard',
    title: 'Firebase TTS',
    providers: [provideEnvironmentInitializer(() => inject(ConfigService).initialize())],
    loadComponent: () => import('./features/dashboard/dashboard.component'),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
