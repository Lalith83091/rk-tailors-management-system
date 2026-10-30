import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const supabase = inject(SupabaseService);

  if (!supabase.configured) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url, setup: 'required' } });
  }
  await auth.ready;
  return await auth.isShopAdmin()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url, unauthorized: auth.user() ? '1' : null } });
};
