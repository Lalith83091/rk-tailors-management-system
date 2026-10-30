import { ErrorHandler, Injectable } from '@angular/core';
import { NotificationService } from '../shared/notification.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private readonly notifications: NotificationService) {}

  handleError(error: unknown): void {
    console.error('Unhandled application error', error);
    this.notifications.show('An unexpected error occurred. Please try again or contact support.', 'error');
  }
}
