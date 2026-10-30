import { Component, OnInit } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Customer, ShopOrder } from '../core/models';
import { ShopDataService } from '../core/shop-data.service';
import { localDateString } from '../core/local-date';

@Component({
  imports: [DatePipe, DecimalPipe],
  selector: 'app-reports',
  templateUrl: './reports.html',
})
export class ReportsComponent implements OnInit {
  orders: ShopOrder[] = [];
  customers: Customer[] = [];
  customerFilter = '';
  loading = true;
  error = '';
  startDate = localDateString(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  endDate = localDateString();

  constructor(private readonly shop: ShopDataService) {}

  async ngOnInit(): Promise<void> {
    try { [this.orders, this.customers] = await Promise.all([this.shop.orders(), this.shop.customers()]); }
    catch (error) {
      console.error('Reports could not be loaded', error);
      this.error = 'Could not load reports from Supabase.';
    } finally { this.loading = false; }
  }

  get filtered(): ShopOrder[] {
    return this.orders.filter((order) => order.order_date >= this.startDate && order.order_date <= this.endDate
      && (!this.customerFilter || order.customer_id === this.customerFilter));
  }

  get received(): number {
    return this.orders
      .filter((order) => !this.customerFilter || order.customer_id === this.customerFilter)
      .reduce((sum, order) => sum + this.paymentsInRange(order), 0);
  }

  paymentsInRange(order: ShopOrder): number {
    return (order.payments ?? []).filter((payment) => payment.paid_at.slice(0, 10) >= this.startDate
      && payment.paid_at.slice(0, 10) <= this.endDate).reduce((sum, payment) => sum + Number(payment.amount), 0);
  }

  get dueOrders(): ShopOrder[] {
    return this.orders.filter((order) => (!this.customerFilter || order.customer_id === this.customerFilter)
      && this.balance(order) > 0);
  }

  get outstanding(): number {
    return this.dueOrders.reduce((sum, order) => sum + this.balance(order), 0);
  }

  get pendingDeliveries(): ShopOrder[] {
    return this.orders.filter((order) => order.expected_delivery_date >= this.startDate && order.expected_delivery_date <= this.endDate
      && (!this.customerFilter || order.customer_id === this.customerFilter)
      && !['Delivered', 'Cancelled'].includes(order.status));
  }

  balance(order: ShopOrder): number {
    return Math.max(0, Number(order.total_amount) - (order.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0));
  }

  setRange(range: 'daily' | 'weekly' | 'monthly'): void {
    const now = new Date();
    const start = new Date(now);
    if (range === 'daily') start.setHours(0, 0, 0, 0);
    if (range === 'weekly') start.setDate(now.getDate() - 6);
    if (range === 'monthly') start.setDate(1);
    this.startDate = localDateString(start);
    this.endDate = localDateString(now);
  }

  exportCsv(): void {
    const rows = [
      ['Order number', 'Customer', 'Order date', 'Expected delivery', 'Status', 'Order total', 'Received', 'Outstanding'],
      ...this.filtered.map((order) => [
        order.order_number,
        order.customer?.full_name ?? '',
        order.order_date,
        order.expected_delivery_date,
        order.status,
        String(order.total_amount),
        String(this.paymentsInRange(order)),
        String(this.balance(order)),
      ]),
    ];
    const csv = rows.map((row) => row.map((field) => {
      const safe = /^[=+\-@]/.test(field) ? `'${field}` : field;
      return `"${safe.replaceAll('"', '""')}"`;
    }).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `rk-tailors-report-${this.startDate}-to-${this.endDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
