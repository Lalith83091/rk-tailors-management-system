import { Injectable } from '@angular/core';
import { Customer, MeasurementProfile, MeasurementVersion, OrderItemInput, PaymentInput, ShopOrder } from './models';
import { SupabaseService } from './supabase.service';
import { localDateString } from './local-date';

@Injectable({ providedIn: 'root' })
export class ShopDataService {
  constructor(private readonly supabase: SupabaseService) {}

  private normalizePhone(value: string | null | undefined): string | null {
    const normalized = value?.replace(/[()\s-]/g, '') ?? '';
    return normalized || null;
  }

  async customers(search = ''): Promise<Customer[]> {
    let query = this.supabase.requireClient().from('customers').select('*').is('archived_at', null).order('created_at', { ascending: false });
    if (search.trim()) query = query.or(`full_name.ilike.%${search.trim()}%,mobile_number.ilike.%${search.trim()}%,customer_number.ilike.%${search.trim()}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Customer[];
  }

  async customer(id: string): Promise<Customer> {
    const { data, error } = await this.supabase.requireClient().from('customers').select('*').eq('id', id).single();
    if (error) throw error;
    return data as Customer;
  }

  async saveCustomer(value: Partial<Customer>): Promise<Customer> {
    const client = this.supabase.requireClient();
    const result = value.id
      ? await client.from('customers').update({
          full_name: value.full_name,
          mobile_number: this.normalizePhone(value.mobile_number)!,
          alternate_number: this.normalizePhone(value.alternate_number),
          address: value.address || null,
          notes: value.notes || null,
        }).eq('id', value.id).select().single()
      : await client.from('customers').insert({
          full_name: value.full_name,
          mobile_number: this.normalizePhone(value.mobile_number)!,
          alternate_number: this.normalizePhone(value.alternate_number),
          address: value.address || null,
          notes: value.notes || null,
        }).select().single();
    if (result.error) throw result.error;
    return result.data as Customer;
  }

  async archiveCustomer(id: string): Promise<void> {
    const { error } = await this.supabase.requireClient().from('customers').update({ archived_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  }

  async measurements(customerId?: string): Promise<MeasurementProfile[]> {
    let query = this.supabase.requireClient().from('measurement_profiles').select('*').order('measured_at', { ascending: false });
    if (customerId) query = query.eq('customer_id', customerId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as MeasurementProfile[];
  }

  async measurementVersions(customerId?: string): Promise<MeasurementVersion[]> {
    let query = this.supabase.requireClient().from('measurement_versions')
      .select('*, profile:measurement_profiles!inner(customer_id,garment_type)')
      .order('measured_at', { ascending: false });
    if (customerId) query = query.eq('profile.customer_id', customerId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as MeasurementVersion[];
  }

  async saveMeasurements(value: Partial<MeasurementProfile>): Promise<void> {
    const { error } = await this.supabase.requireClient().rpc('save_measurement_version', {
      p_customer_id: value.customer_id,
      p_garment_type: value.garment_type,
      p_unit: value.unit,
      p_measurements: value.measurements,
      p_fit_type: value.fit_type || null,
      p_notes: value.notes || null,
      p_measured_at: value.measured_at,
    });
    if (error) throw error;
  }

  async orders(): Promise<ShopOrder[]> {
    const { data, error } = await this.supabase.requireClient().from('orders')
      .select('*, customer:customers(full_name,mobile_number), order_items(*), payments(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ShopOrder[];
  }

  async order(id: string): Promise<ShopOrder> {
    const { data, error } = await this.supabase.requireClient().from('orders')
      .select('*, customer:customers(full_name,mobile_number,address), order_items(*), payments(*)')
      .eq('id', id).single();
    if (error) throw error;
    return data as ShopOrder;
  }

  async createOrder(order: {
    customer_id: string;
    order_date: string;
    expected_delivery_date: string;
    discount: number;
    advance_amount: number;
    advance_method: string;
    special_instructions: string;
    notes: string;
    items: OrderItemInput[];
  }): Promise<string> {
    const { data, error } = await this.supabase.requireClient().rpc('create_stitching_order', {
      p_customer_id: order.customer_id,
      p_order_date: order.order_date,
      p_expected_delivery_date: order.expected_delivery_date,
      p_discount: order.discount,
      p_advance_amount: order.advance_amount,
      p_advance_method: order.advance_method,
      p_special_instructions: order.special_instructions || null,
      p_notes: order.notes || null,
      p_items: order.items,
    });
    if (error) throw error;
    if (typeof data !== 'string') throw new Error('Order creation returned an invalid database response.');
    return data;
  }

  async updateOrderStatus(id: string, status: string): Promise<void> {
    const { error } = await this.supabase.requireClient().rpc('update_order_status', { p_order_id: id, p_status: status });
    if (error) throw error;
  }

  async addPayment(payment: PaymentInput): Promise<void> {
    const { error } = await this.supabase.requireClient().rpc('record_order_payment', {
      p_order_id: payment.order_id,
      p_amount: payment.amount,
      p_method: payment.method,
      p_reference: payment.reference || null,
    });
    if (error) throw error;
  }

  async dashboard(): Promise<{
    customers: number;
    orders: number;
    pending: number;
    completed: number;
    upcoming: number;
    overdue: number;
    collected: number;
    outstanding: number;
    recent: ShopOrder[];
    statuses: Array<{ status: string; count: number }>;
  }> {
    const client = this.supabase.requireClient();
    const [customers, orders, payments] = await Promise.all([
      client.from('customers').select('id', { count: 'exact', head: true }).is('archived_at', null),
      client.from('orders').select('*, payments(amount)', { count: 'exact' }),
      client.from('payments').select('amount'),
    ]);
    if (customers.error) throw customers.error;
    if (orders.error) throw orders.error;
    if (payments.error) throw payments.error;
    const orderRows = (orders.data ?? []) as Array<ShopOrder & { payments: Array<{ amount: number }> }>;
    const today = localDateString();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const weekEnd = localDateString(nextWeek);
    const outstanding = orderRows.reduce((total, order) => total + Math.max(0,
      Number(order.total_amount) - order.payments.reduce((sum, payment) => sum + Number(payment.amount), 0)), 0);
    return {
      customers: customers.count ?? 0,
      orders: orders.count ?? 0,
      pending: orderRows.filter((order) => !['Delivered', 'Cancelled'].includes(order.status)).length,
      completed: orderRows.filter((order) => order.status === 'Delivered').length,
      upcoming: orderRows.filter((order) => order.expected_delivery_date >= today && order.expected_delivery_date <= weekEnd
        && !['Delivered', 'Cancelled'].includes(order.status)).length,
      overdue: orderRows.filter((order) => order.expected_delivery_date < today && !['Delivered', 'Cancelled'].includes(order.status)).length,
      collected: (payments.data ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0),
      outstanding,
      recent: orderRows.slice(0, 6),
      statuses: ['New', 'Cutting', 'Stitching', 'Trial', 'Ready', 'Delivered', 'Cancelled']
        .map((status) => ({ status, count: orderRows.filter((order) => order.status === status).length })),
    };
  }
}
