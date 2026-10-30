import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { SupabaseService } from '../core/supabase.service';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-login',
  templateUrl: './login.html',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  readonly supabase = inject(SupabaseService);
  private readonly route = inject(ActivatedRoute);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  submitting = false;
  error = '';

  constructor() {
    if (this.route.snapshot.queryParamMap.has('unauthorized')) {
      this.error = 'This account is not authorized for the shop workspace. Ask the shop owner to authorize it.';
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid || !this.supabase.configured) {
      this.form.markAllAsTouched();
      return;
    }
    this.error = '';
    this.submitting = true;
    try {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      await this.auth.signIn(this.form.controls.email.value, this.form.controls.password.value, returnUrl || '/dashboard');
    } catch (error) {
      console.error('Authentication failed', error);
      this.error = 'Sign in failed. Check your email and password, then try again.';
    } finally {
      this.submitting = false;
    }
  }
}
