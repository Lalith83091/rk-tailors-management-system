import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Customer, MeasurementVersion, ShopOrder } from '../core/models';
import { ShopDataService } from '../core/shop-data.service';
import { EmptyStateComponent } from '../shared/empty-state';
import { NotificationService } from '../shared/notification.service';

@Component({
  imports: [DatePipe, ReactiveFormsModule, EmptyStateComponent],
  selector: 'app-customers',
  templateUrl: './customers.html',
})
export class CustomersComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly shop = inject(ShopDataService);
  private readonly notifications = inject(NotificationService);
  customers: Customer[] = [];
  selected: Customer | null = null;
  historyOrders: ShopOrder[] = [];
  historyMeasurements: MeasurementVersion[] = [];
  search = '';
  editing: Customer | null = null;
  panelOpen = false;
  loading = true;
  saving = false;
  error = '';
  message = '';
  private searchTimer?: number;
  readonly form = this.fb.nonNullable.group({
    full_name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)]],
    mobile_number: ['', [Validators.required, Validators.pattern(/^[+]?[0-9\s()-]{8,16}$/)]],
    alternate_number: ['', Validators.pattern(/^[+]?[0-9\s()-]{8,16}$/)],
    address: [''],
    notes: [''],
  });

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try { this.customers = await this.shop.customers(this.search); }
    catch (error) {
      console.error('Customers could not be loaded', error);
      this.error = 'Could not load customers. Confirm Supabase is configured and the migration is applied.';
    } finally { this.loading = false; }
  }

  onSearch(event: Event): void {
    this.search = (event.target as HTMLInputElement).value;
    window.clearTimeout(this.searchTimer);
    this.searchTimer = window.setTimeout(() => void this.load(), 250);
  }

  ngOnDestroy(): void { window.clearTimeout(this.searchTimer); }

  newCustomer(): void {
    this.editing = null;
    this.form.reset();
    this.panelOpen = true;
    this.message = '';
  }

  editCustomer(customer: Customer): void {
    this.editing = customer;
    this.form.reset({
      full_name: customer.full_name,
      mobile_number: customer.mobile_number,
      alternate_number: customer.alternate_number ?? '',
      address: customer.address ?? '',
      notes: customer.notes ?? '',
    });
    this.panelOpen = true;
  }

  async save(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    this.error = '';
    try {
      await this.shop.saveCustomer({ ...this.form.getRawValue(), id: this.editing?.id });
      this.panelOpen = false;
      this.message = this.editing ? 'Customer details updated.' : 'Customer added successfully.';
      this.notifications.show(this.message);
      await this.load();
    } catch (error) {
      console.error('Customer could not be saved', error);
      this.error = 'Could not save this customer. A mobile number may already be registered.';
      this.notifications.show(this.error, 'error');
    } finally { this.saving = false; }
  }

  async archive(customer: Customer): Promise<void> {
    if (!window.confirm(`Archive ${customer.full_name}? Their order history will be retained.`)) return;
    try {
      await this.shop.archiveCustomer(customer.id);
      if (this.selected?.id === customer.id) this.selected = null;
      this.message = 'Customer archived. Their records remain available for historical orders.';
      this.notifications.show(this.message);
      await this.load();
    } catch (error) {
      console.error('Customer could not be archived', error);
      this.error = 'Could not archive this customer.';
      this.notifications.show(this.error, 'error');
    }
  }

  async viewProfile(customer: Customer): Promise<void> {
    this.selected = customer;
    try {
      const [orders, measurements] = await Promise.all([this.shop.orders(), this.shop.measurementVersions(customer.id)]);
      this.historyOrders = orders.filter((order) => order.customer_id === customer.id);
      this.historyMeasurements = measurements;
    } catch (error) {
      console.error('Customer history could not be loaded', error);
      this.error = 'Customer profile history could not be loaded.';
    }
  }
}
