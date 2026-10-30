import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="empty-state" role="status">
      <i [class]="icon" aria-hidden="true"></i>
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
      @if (actionLabel) {
        <button class="text-link" type="button" (click)="action.emit()">{{ actionLabel }}</button>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() icon = 'bi bi-inbox';
  @Input() actionLabel = '';
  @Output() readonly action = new EventEmitter<void>();
}
