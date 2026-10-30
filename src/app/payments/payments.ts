import { Component, OnInit, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PaymentMethod, ShopOrder } from '../core/models';
import { ShopDataService } from '../core/shop-data.service';
import { EmptyStateComponent } from '../shared/empty-state';
import { NotificationService } from '../shared/notification.service';

@Component({
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, EmptyStateComponent],
  selector: 'app-payments',
  templateUrl: './payments.html',
})
export class PaymentsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly shop = inject(ShopDataService);
  private readonly notifications = inject(NotificationService);
  readonly methods: PaymentMethod[] = ['Cash', 'UPI', 'Card', 'Other'];
  readonly form = this.fb.nonNullable.group({
    order_id: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    method: ['Cash' as PaymentMethod, Validators.required],
    reference: [''],
  });
  orders: ShopOrder[] = [];
  loading = true;
  saving = false;
  error = '';
  message = '';

  async ngOnInit(): Promise<void> {
    try { this.orders = await this.shop.orders(); }
    catch (error) {
      console.error('Payment data could not be loaded', error);
      this.error = 'Could not load payment records.';
    } finally { this.loading = false; }
  }

  balance(order: ShopOrder): number {
    return Math.max(0, Number(order.total_amount) - (order.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0));
  }

  get selectedOrder(): ShopOrder | undefined {
    return this.orders.find((order) => order.id === this.form.controls.order_id.value);
  }

  async save(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    const balance = this.selectedOrder ? this.balance(this.selectedOrder) : 0;
    if (raw.amount > balance) {
      this.error = `Payment exceeds the outstanding balance of ₹${balance.toFixed(2)}.`;
      return;
    }
    this.error = '';
    this.saving = true;
    try {
      await this.shop.addPayment({ ...raw, amount: Number(raw.amount) });
      this.message = 'Payment recorded successfully.';
      this.notifications.show(this.message);
      this.form.patchValue({ amount: 0, reference: '' });
      try {
        this.orders = await this.shop.orders();
      } catch (error) {
        console.error('Payment recorded but transaction history could not be refreshed', error);
        this.error = 'Payment recorded, but history could not be refreshed. Reload the page to confirm the new balance.';
        this.notifications.show(this.error, 'error');
      }
    } catch (error) {
      console.error('Payment could not be recorded', error);
      this.error = 'Payment could not be recorded. The order balance may have changed; refresh and try again.';
      this.notifications.show(this.error, 'error');
    } finally { this.saving = false; }
  }
}
