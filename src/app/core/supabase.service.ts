import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly configured = Boolean(environment.supabaseUrl && environment.supabasePublishableKey);
  readonly client: SupabaseClient | null = this.configured
    ? createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;

  requireClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase is not configured. Add the project URL and publishable anon key to src/environments/environment.ts.');
    }
    return this.client;
  }
}
