import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  message: string;
  kind: 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly messages = signal<ToastMessage[]>([]);
  private nextId = 0;

  show(message: string, kind: ToastMessage['kind'] = 'success'): void {
    const id = ++this.nextId;
    this.messages.update((items) => [...items, { id, message, kind }]);
    window.setTimeout(() => this.dismiss(id), 5000);
  }

  dismiss(id: number): void {
    this.messages.update((items) => items.filter((item) => item.id !== id));
  }
}
