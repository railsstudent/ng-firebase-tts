import { Routes } from '@angular/router';
import DashboardComponent from './features/dashboard/dashboard.component';

export const ROUTE_PATHS = {
  HOME: 'home',
  DASHBOARD: 'dashboard',
} as const;

export type AppRoute = `/${(typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS]}`;

export const routes: Routes = [
  {
    path: 'home',
    title: 'Home',
    component: DashboardComponent,
  },
  {
    path: 'dashboard',
    title: 'Firebase TTS',
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
