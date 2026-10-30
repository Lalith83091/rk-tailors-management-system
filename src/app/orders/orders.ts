import { Component, OnInit, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Customer, MeasurementProfile, OrderItemInput, OrderStatus, ShopOrder } from '../core/models';
import { ShopDataService } from '../core/shop-data.service';
import { localDateString } from '../core/local-date';
import { EmptyStateComponent } from '../shared/empty-state';
import { NotificationService } from '../shared/notification.service';

const STATUSES: OrderStatus[] = ['New', 'Cutting', 'Stitching', 'Trial', 'Ready', 'Delivered', 'Cancelled'];

@Component({
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, EmptyStateComponent],
  selector: 'app-orders',
  templateUrl: './orders.html',
})
export class OrdersComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly shop = inject(ShopDataService);
  private readonly notifications = inject(NotificationService);
  readonly statuses = STATUSES;
  readonly garments = ['Shirt', 'Pant', 'Kurta', 'Pajama', 'Suit', 'Blazer', 'Sherwani', 'Other'];
  readonly form = this.fb.nonNullable.group({
    customer_id: [''],
    new_customer_name: [''],
    new_customer_mobile: [''],
    order_date: [localDateString(), Validators.required],
    expected_delivery_date: ['', Validators.required],
    discount: [0, [Validators.min(0)]],
    advance_amount: [0, [Validators.min(0)]],
    advance_method: ['Cash'],
    special_instructions: [''],
    notes: [''],
  });
  customers: Customer[] = [];
  profiles: MeasurementProfile[] = [];
  orders: ShopOrder[] = [];
  items: Array<{ garment_type: string; quantity: number; stitching_charge: number }> = [this.newItem()];
  search = '';
  statusFilter = '';
  dueFilter: 'all' | 'upcoming' | 'overdue' = 'all';
  quickAdd = false;
  showForm = false;
  selected: ShopOrder | null = null;
  loading = true;
  saving = false;
  updatingId = '';
  error = '';
  message = '';

  async ngOnInit(): Promise<void> {
    try { [this.customers, this.orders] = await Promise.all([this.shop.customers(), this.shop.orders()]); }
    catch (error) {
      console.error('Orders could not be loaded', error);
      this.error = 'Could not load orders. Confirm Supabase is configured and the database migration is applied.';
    } finally { this.loading = false; }
  }

  private newItem(): { garment_type: string; quantity: number; stitching_charge: number } {
    return { garment_type: 'Shirt', quantity: 1, stitching_charge: 0 };
  }

  addItem(): void { this.items.push(this.newItem()); }
  removeItem(index: number): void { if (this.items.length > 1) this.items.splice(index, 1); }
  updateItem(index: number, field: 'garment_type' | 'quantity' | 'stitching_charge', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (field === 'garment_type') this.items[index].garment_type = value;
    else if (field === 'quantity') this.items[index].quantity = Number(value);
    else this.items[index].stitching_charge = Number(value);
  }

  async customerChanged(event: Event): Promise<void> {
    const id = (event.target as HTMLSelectElement).value;
    this.error = '';
    try { this.profiles = id ? await this.shop.measurements(id) : []; }
    catch (error) {
      console.error('Customer measurements could not be loaded for the order', error);
      this.profiles = [];
      this.error = 'Saved measurements could not be loaded; this order will not include a measurement snapshot.';
    }
  }

  get subtotal(): number {
    return this.items.reduce((sum, item) => sum + item.quantity * item.stitching_charge, 0);
  }

  get totalAfterDiscount(): number {
    return Math.max(0, this.subtotal - Number(this.form.controls.discount.value || 0));
  }

  hasProfile(garmentType: string): boolean {
    return this.profiles.some((profile) => profile.garment_type === garmentType);
  }

  measurementSummary(snapshot: Record<string, unknown>): string {
    const values = snapshot['measurements'] as Record<string, number> | undefined;
    return values ? Object.entries(values).map(([key, value]) => `${key.replaceAll('_', ' ')} ${value}`).join(' · ') : '';
  }

  get filteredOrders(): ShopOrder[] {
    const term = this.search.trim().toLowerCase();
    const today = localDateString();
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const week = localDateString(weekEnd);
    return this.orders.filter((order) => (!this.statusFilter || order.status === this.statusFilter)
      && (this.dueFilter === 'all' || (this.dueFilter === 'upcoming'
        ? order.expected_delivery_date >= today && order.expected_delivery_date <= week && !['Delivered', 'Cancelled'].includes(order.status)
        : order.expected_delivery_date < today && !['Delivered', 'Cancelled'].includes(order.status)))
      && (!term || order.order_number.toLowerCase().includes(term) || order.customer?.full_name?.toLowerCase().includes(term) || order.customer?.mobile_number?.includes(term)));
  }

  async create(): Promise<void> {
    const raw = this.form.getRawValue();
    if (!this.quickAdd && !raw.customer_id) {
      this.error = 'Select a customer or use quick add.';
      return;
    }
    if (this.quickAdd && (!raw.new_customer_name.trim() || !/^[+]?[0-9\s()-]{8,16}$/.test(raw.new_customer_mobile))) {
      this.error = 'Enter a customer name and valid mobile number.';
      return;
    }
    if (raw.expected_delivery_date < raw.order_date || Number(raw.discount) > this.subtotal
      || Number(raw.advance_amount) > this.totalAfterDiscount) {
      this.error = 'Delivery cannot be before the order date; discounts and advances cannot exceed the order total.';
      return;
    }
    if (this.form.invalid || !this.items.length || this.items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1
      || !Number.isFinite(item.stitching_charge) || item.stitching_charge < 0)) {
      this.form.markAllAsTouched();
      this.error = 'Check the order dates, quantities and non-negative charges.';
      return;
    }
    this.saving = true;
    this.error = '';
    let quickCustomerAdded = false;
    try {
      const customer = this.quickAdd
        ? await this.shop.saveCustomer({ full_name: raw.new_customer_name, mobile_number: raw.new_customer_mobile })
        : this.customers.find((item) => item.id === raw.customer_id);
      quickCustomerAdded = this.quickAdd;
      if (!customer) {
        this.error = 'The selected customer could not be found. Refresh the customer list and try again.';
        return;
      }
      const items: OrderItemInput[] = this.items.map((item) => {
        const profile = this.profiles.find((entry) => entry.garment_type === item.garment_type);
        return {
          ...item,
          measurement_snapshot: profile ? {
            unit: profile.unit,
            garment_type: profile.garment_type,
            measurements: profile.measurements,
            fit_type: profile.fit_type,
            measured_at: profile.measured_at,
            version: profile.version,
          } : {},
        };
      });
      await this.shop.createOrder({
        customer_id: customer.id,
        order_date: raw.order_date,
        expected_delivery_date: raw.expected_delivery_date,
        discount: Number(raw.discount),
        advance_amount: Number(raw.advance_amount),
        advance_method: raw.advance_method,
        special_instructions: raw.special_instructions,
        notes: raw.notes,
        items,
      });
      this.message = 'Order created successfully with its own measurement snapshots.';
      this.notifications.show(this.message);
      this.showForm = false;
      this.form.reset({ order_date: localDateString(), advance_method: 'Cash', discount: 0, advance_amount: 0 });
      this.items = [this.newItem()];
      try {
        [this.customers, this.orders] = await Promise.all([this.shop.customers(), this.shop.orders()]);
      } catch (error) {
        console.error('Order saved but the order list could not be refreshed', error);
        this.error = 'Order created, but the order list could not be refreshed. Reload the page to see it.';
        this.notifications.show(this.error, 'error');
      }
    } catch (error) {
      console.error('Order could not be created', error);
      this.error = quickCustomerAdded
        ? 'The customer was added, but the order was not created. Review the order and try again.'
        : 'Could not create the order. Verify the customer, delivery date and payment amount.';
      this.notifications.show(this.error, 'error');
    } finally { this.saving = false; }
  }

  async changeStatus(order: ShopOrder, event: Event): Promise<void> {
    const status = (event.target as HTMLSelectElement).value as OrderStatus;
    this.updatingId = order.id;
    try {
      await this.shop.updateOrderStatus(order.id, status);
      order.status = status;
      this.message = `Order ${order.order_number} updated to ${status}.`;
      this.notifications.show(this.message);
    } catch (error) {
      console.error('Order status could not be updated', error);
      this.error = 'Could not update order status.';
      this.notifications.show(this.error, 'error');
    } finally { this.updatingId = ''; }
  }

  async showOrder(order: ShopOrder): Promise<void> {
    try {
      this.selected = await this.shop.order(order.id);
    } catch (error) {
      console.error('Order details could not be loaded', error);
      this.error = 'Could not load order details.';
    }
  }

  orderBalance(order: ShopOrder): number {
    return Math.max(0, Number(order.total_amount) - (order.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0));
  }

  statusClass(status: string): string {
    return status.toLowerCase().replaceAll(' ', '-');
  }

  printReceipt(): void { window.print(); }
}
