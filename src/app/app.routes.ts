import { Routes } from '@angular/router';
import DashboardComponent from './features/dashboard/dashboard.component';

export const routes: Routes = [
  {
    path: 'dashboard',
    title: 'Firebase TTS',
    // loadComponent: () => import('./features/dashboard/dashboard.component'),
    component: DashboardComponent,
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
