import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(null);
  readonly initialized = signal(false);
  readonly ready: Promise<void>;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly router: Router,
  ) {
    if (this.supabase.client) {
      this.ready = this.supabase.client.auth.getSession().then(({ data, error }) => {
        if (error) console.error('Could not restore the Supabase session', error);
        this.setSession(data.session);
        this.initialized.set(true);
      }).catch((error: unknown) => {
        console.error('Could not initialize Supabase authentication', error);
        this.initialized.set(true);
      });
      this.supabase.client.auth.onAuthStateChange((_event, session) => this.setSession(session));
    } else {
      this.initialized.set(true);
      this.ready = Promise.resolve();
    }
  }

  async isShopAdmin(): Promise<boolean> {
    const user = this.user();
    if (!user || !this.supabase.client) return false;
    const { data, error } = await this.supabase.client.from('profiles')
      .select('user_id').eq('user_id', user.id).maybeSingle();
    if (error) {
      console.error('Shop administrator authorization check failed', error);
      return false;
    }
    return Boolean(data);
  }

  async signIn(email: string, password: string, returnUrl = '/dashboard'): Promise<void> {
    const { data, error } = await this.supabase.requireClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.setSession(data.session);
    const destination = returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/dashboard';
    await this.router.navigateByUrl(destination);
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.requireClient().auth.signOut();
    if (error) throw error;
    this.user.set(null);
    await this.router.navigateByUrl('/');
  }

  private setSession(session: Session | null): void {
    this.user.set(session?.user ?? null);
    this.initialized.set(true);
  }
}
