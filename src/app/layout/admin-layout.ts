import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.html',
})
export class AdminLayoutComponent {
  readonly auth = inject(AuthService);
  readonly today = new Intl.DateTimeFormat('en-IN', { dateStyle: 'full' }).format(new Date());
  navOpen = false;

  async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
    } catch (error) {
      console.error('Sign out failed', error);
    }
  }
}
