import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', loadComponent: () => import('./home/home').then((module) => module.HomeComponent), title: 'R.K. Tailors | Gents Specialist' },
  { path: 'login', loadComponent: () => import('./auth/login').then((module) => module.LoginComponent), title: 'Admin Login | R.K. Tailors' },
  {
    path: '',
    canActivateChild: [authGuard],
    loadComponent: () => import('./layout/admin-layout').then((module) => module.AdminLayoutComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard').then((module) => module.DashboardComponent), title: 'Dashboard | R.K. Tailors' },
      { path: 'customers', loadComponent: () => import('./customers/customers').then((module) => module.CustomersComponent), title: 'Customers | R.K. Tailors' },
      { path: 'measurements', loadComponent: () => import('./measurements/measurements').then((module) => module.MeasurementsComponent), title: 'Measurements | R.K. Tailors' },
      { path: 'orders', loadComponent: () => import('./orders/orders').then((module) => module.OrdersComponent), title: 'Orders | R.K. Tailors' },
      { path: 'payments', loadComponent: () => import('./payments/payments').then((module) => module.PaymentsComponent), title: 'Payments | R.K. Tailors' },
      { path: 'reports', loadComponent: () => import('./reports/reports').then((module) => module.ReportsComponent), title: 'Reports | R.K. Tailors' },
    ],
  },
  { path: '**', redirectTo: '' },
];
