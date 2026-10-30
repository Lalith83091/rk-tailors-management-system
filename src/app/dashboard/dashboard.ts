import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ShopDataService } from '../core/shop-data.service';
import { ShopOrder } from '../core/models';

@Component({
  imports: [CommonModule, RouterLink],
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
})
export class DashboardComponent implements OnInit {
  data: Awaited<ReturnType<ShopDataService['dashboard']>> | null = null;
  loading = true;
  error = '';

  constructor(private readonly shop: ShopDataService) {}

  async ngOnInit(): Promise<void> {
    try {
      this.data = await this.shop.dashboard();
    } catch (error) {
      console.error('Dashboard data could not be loaded', error);
      this.error = 'Could not load live dashboard data. Check your Supabase configuration and database migration.';
    } finally {
      this.loading = false;
    }
  }

  statusClass(status: string): string {
    return `status-${status.toLowerCase().replaceAll(' ', '-')}`;
  }

  statusPercent(count: number): number {
    const total = this.data?.orders ?? 0;
    return total ? count / total * 100 : 0;
  }

  balance(order: ShopOrder): number {
    const paid = (order.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
    return Math.max(0, Number(order.total_amount) - paid);
  }
}
