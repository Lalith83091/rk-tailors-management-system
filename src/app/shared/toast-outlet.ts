import { Component, inject } from '@angular/core';
import { NotificationService } from './notification.service';

@Component({
  selector: 'app-toast-outlet',
  template: `
    <div class="toast-outlet" aria-live="polite" aria-relevant="additions">
      @for (toast of notifications.messages(); track toast.id) {
        <div class="app-toast" [class.error]="toast.kind === 'error'" [attr.role]="toast.kind === 'error' ? 'alert' : 'status'">
          <i [class]="toast.kind === 'error' ? 'bi bi-exclamation-circle' : 'bi bi-check-circle'" aria-hidden="true"></i>
          <span>{{ toast.message }}</span>
          <button type="button" aria-label="Dismiss notification" (click)="notifications.dismiss(toast.id)"><i class="bi bi-x-lg"></i></button>
        </div>
      }
    </div>
  `,
})
export class ToastOutletComponent {
  readonly notifications = inject(NotificationService);
}
